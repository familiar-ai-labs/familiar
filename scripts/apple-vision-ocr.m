// apple-vision-ocr.m
//
// Native OCR helper for Jiminy: runs Apple Vision text recognition and emits JSON to stdout.
// This is intentionally a small CLI binary so the Electron app can run local OCR without
// bundling Swift runtime dependencies.
//
// Supported macOS: 14+ (deployment target is enforced in build-apple-vision-ocr.sh)
//
// Output JSON schema (stdout):
//   { meta: {...}, lines: [...], observations?: [...] }
//
// Errors are printed to stderr prefixed with "error:" and return a non-zero exit code.

#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <Vision/Vision.h>
#import <math.h>
#import <stdlib.h>
#import <CoreML/CoreML.h>

typedef NS_ENUM(NSInteger, JMOcrLevel) {
  JMOcrLevelAccurate = 0,
  JMOcrLevelFast = 1,
};

static void JMFail(NSString *message, int exitCode) {
  if (!message) {
    message = @"Unknown error.";
  }
  fprintf(stderr, "error: %s\n", message.UTF8String);
  exit(exitCode);
}

static NSString *JMUsage(void) {
  return [@[
    @"Usage:",
    @"  apple-vision-ocr --image <path> [--level accurate|fast] [--languages en-US,es-ES] [--no-correction] [--min-confidence 0.0-1.0] [--no-observations]",
    @"",
    @"Output:",
    @"  JSON to stdout: { meta, lines, observations? }",
  ] componentsJoinedByString:@"\n"];
}

static NSString *JMTrim(NSString *value) {
  if (![value isKindOfClass:[NSString class]]) {
    return @"";
  }
  return [value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
}

static BOOL JMParseDoubleStrict(NSString *raw, double *outValue) {
  if (!raw) {
    return NO;
  }
  NSString *trimmed = JMTrim(raw);
  if (trimmed.length == 0) {
    return NO;
  }
  const char *cstr = trimmed.UTF8String;
  if (!cstr) {
    return NO;
  }
  char *end = NULL;
  double value = strtod(cstr, &end);
  if (end == cstr || (end && *end != '\0')) {
    return NO;
  }
  if (!isfinite(value)) {
    return NO;
  }
  if (outValue) {
    *outValue = value;
  }
  return YES;
}

static NSArray<NSString *> *JMParseLanguages(NSString *raw) {
  NSString *trimmed = JMTrim(raw);
  if (trimmed.length == 0) {
    return @[];
  }
  NSArray<NSString *> *parts = [trimmed componentsSeparatedByString:@","];
  NSMutableArray<NSString *> *langs = [NSMutableArray arrayWithCapacity:parts.count];
  for (NSString *part in parts) {
    NSString *lang = JMTrim(part);
    if (lang.length > 0) {
      [langs addObject:lang];
    }
  }
  return langs;
}

typedef struct {
  CGImageRef image;
  size_t width;
  size_t height;
  CGImagePropertyOrientation orientation;
} JMDecodedImage;

static id<MLComputeDeviceProtocol> JMResolveCpuComputeDevice(void) {
  Class cpuClass = NSClassFromString(@"MLCPUComputeDevice");
  if (!cpuClass) {
    return nil;
  }

  NSArray<id<MLComputeDeviceProtocol>> *devices = MLAllComputeDevices();
  for (id<MLComputeDeviceProtocol> dev in devices) {
    if ([dev isKindOfClass:cpuClass]) {
      return dev;
    }
  }
  return nil;
}

static void JMApplyCpuComputeDeviceToRequest(VNRequest *request) {
  if (!request) {
    return;
  }

  id<MLComputeDeviceProtocol> cpuDevice = JMResolveCpuComputeDevice();
  if (!cpuDevice) {
    return;
  }

  NSError *devicesError = nil;
  NSDictionary<VNComputeStage, NSArray<id<MLComputeDeviceProtocol>>*> *supported =
    [request supportedComputeStageDevicesAndReturnError:&devicesError];
  if (!supported || devicesError) {
    return;
  }

  Class cpuClass = NSClassFromString(@"MLCPUComputeDevice");
  for (VNComputeStage stage in supported) {
    NSArray<id<MLComputeDeviceProtocol>> *stageDevices = supported[stage];
    BOOL stageSupportsCpu = NO;
    for (id<MLComputeDeviceProtocol> dev in stageDevices) {
      if (dev == cpuDevice) {
        stageSupportsCpu = YES;
        break;
      }
      if (cpuClass && [dev isKindOfClass:cpuClass]) {
        stageSupportsCpu = YES;
        break;
      }
    }
    if (stageSupportsCpu) {
      [request setComputeDevice:cpuDevice forComputeStage:stage];
    }
  }
}

static CGImageRef JMConvertToBGRA(CGImageRef input) {
  if (!input) {
    return NULL;
  }

  const size_t width = CGImageGetWidth(input);
  const size_t height = CGImageGetHeight(input);
  if (width == 0 || height == 0) {
    return NULL;
  }

  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  if (!colorSpace) {
    return NULL;
  }

  const size_t bytesPerRow = width * 4;
  CGBitmapInfo bitmapInfo = (CGBitmapInfo)(kCGBitmapByteOrder32Little | kCGImageAlphaPremultipliedFirst);
  CGContextRef ctx = CGBitmapContextCreate(NULL, width, height, 8, bytesPerRow, colorSpace, bitmapInfo);
  CGColorSpaceRelease(colorSpace);
  if (!ctx) {
    return NULL;
  }

  CGContextSetBlendMode(ctx, kCGBlendModeCopy);
  CGContextDrawImage(ctx, CGRectMake(0, 0, (CGFloat)width, (CGFloat)height), input);
  CGImageRef output = CGBitmapContextCreateImage(ctx);
  CGContextRelease(ctx);
  return output;
}

static BOOL JMIs32BitBGRA(CGImageRef image) {
  if (!image) {
    return NO;
  }

  const size_t bpp = CGImageGetBitsPerPixel(image);
  const size_t bpc = CGImageGetBitsPerComponent(image);
  if (bpp != 32 || bpc != 8) {
    return NO;
  }

  CGColorSpaceRef cs = CGImageGetColorSpace(image);
  if (!cs || CGColorSpaceGetModel(cs) != kCGColorSpaceModelRGB) {
    return NO;
  }

  const CGBitmapInfo info = CGImageGetBitmapInfo(image);
  const CGBitmapInfo order = (CGBitmapInfo)(info & kCGBitmapByteOrderMask);
  if (order != kCGBitmapByteOrder32Little) {
    return NO;
  }

  const CGImageAlphaInfo alpha = CGImageGetAlphaInfo(image);
  return alpha == kCGImageAlphaPremultipliedFirst || alpha == kCGImageAlphaFirst;
}

static JMDecodedImage JMDecodeImage(NSURL *url, NSString *imagePathForError) {
  JMDecodedImage decoded;
  decoded.image = NULL;
  decoded.width = 0;
  decoded.height = 0;
  decoded.orientation = kCGImagePropertyOrientationUp;

  if (!url) {
    JMFail(@"Image URL is required.", 1);
  }

  CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
  if (!source) {
    JMFail([NSString stringWithFormat:@"Failed to create image source: %@", imagePathForError ?: @"(unknown)"], 1);
  }

  NSDictionary *props =
    (__bridge_transfer NSDictionary *)CGImageSourceCopyPropertiesAtIndex(source, 0, NULL);
  NSNumber *orientationValue = props[(NSString *)kCGImagePropertyOrientation];
  if ([orientationValue respondsToSelector:@selector(intValue)]) {
    int o = orientationValue.intValue;
    if (o >= 1 && o <= 8) {
      decoded.orientation = (CGImagePropertyOrientation)o;
    }
  }

  CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, NULL);
  CFRelease(source);

  if (!image) {
    JMFail([NSString stringWithFormat:@"Failed to decode image data: %@", imagePathForError ?: @"(unknown)"], 1);
  }

  decoded.image = image;
  decoded.width = CGImageGetWidth(image);
  decoded.height = CGImageGetHeight(image);

  // Some formats (notably WebP) can decode into CGImage variants that Vision doesn't accept.
  // Normalize to 32-bit BGRA to keep OCR reliable across macOS 14/15/16.
  if (!JMIs32BitBGRA(decoded.image)) {
    CGImageRef converted = JMConvertToBGRA(decoded.image);
    if (converted) {
      CGImageRelease(decoded.image);
      decoded.image = converted;
      decoded.width = CGImageGetWidth(converted);
      decoded.height = CGImageGetHeight(converted);
    }
  }

  return decoded;
}

int main(int argc, const char * argv[]) {
  @autoreleasepool {
    NSString *imagePath = @"";
    JMOcrLevel level = JMOcrLevelAccurate;
    NSArray<NSString *> *languages = @[];
    BOOL usesLanguageCorrection = YES;
    double minConfidence = 0.0;
    BOOL emitObservations = YES;

    for (int i = 1; i < argc; i += 1) {
      NSString *arg = [NSString stringWithUTF8String:argv[i]];
      if ([arg isEqualToString:@"--help"] || [arg isEqualToString:@"-h"]) {
        printf("%s\n", JMUsage().UTF8String);
        return 0;
      }

      NSString *nextValue = nil;
      if (i + 1 < argc) {
        nextValue = [NSString stringWithUTF8String:argv[i + 1]];
      }

      if ([arg isEqualToString:@"--image"]) {
        if (!nextValue) {
          JMFail(@"Missing value for --image.", 1);
        }
        imagePath = nextValue;
        i += 1;
        continue;
      }
      if ([arg hasPrefix:@"--image="]) {
        imagePath = [arg substringFromIndex:[@"--image=" length]];
        continue;
      }

      if ([arg isEqualToString:@"--level"]) {
        if (!nextValue) {
          JMFail(@"Missing value for --level.", 1);
        }
        NSString *raw = [JMTrim(nextValue).lowercaseString copy];
        if ([raw isEqualToString:@"accurate"]) {
          level = JMOcrLevelAccurate;
        } else if ([raw isEqualToString:@"fast"]) {
          level = JMOcrLevelFast;
        } else {
          JMFail([NSString stringWithFormat:@"Invalid --level: %@", raw], 1);
        }
        i += 1;
        continue;
      }
      if ([arg hasPrefix:@"--level="]) {
        NSString *raw = JMTrim([[arg substringFromIndex:[@"--level=" length]] lowercaseString]);
        if ([raw isEqualToString:@"accurate"]) {
          level = JMOcrLevelAccurate;
        } else if ([raw isEqualToString:@"fast"]) {
          level = JMOcrLevelFast;
        } else {
          JMFail([NSString stringWithFormat:@"Invalid --level: %@", raw], 1);
        }
        continue;
      }

      if ([arg isEqualToString:@"--languages"] || [arg isEqualToString:@"--langs"] || [arg isEqualToString:@"--lang"]) {
        if (!nextValue) {
          JMFail([NSString stringWithFormat:@"Missing value for %@.", arg], 1);
        }
        languages = JMParseLanguages(nextValue);
        i += 1;
        continue;
      }
      if ([arg hasPrefix:@"--languages="] || [arg hasPrefix:@"--langs="] || [arg hasPrefix:@"--lang="]) {
        NSArray<NSString *> *parts = [arg componentsSeparatedByString:@"="];
        if (parts.count < 2) {
          JMFail([NSString stringWithFormat:@"Missing value for %@.", arg], 1);
        }
        languages = JMParseLanguages(parts[1]);
        continue;
      }

      if ([arg isEqualToString:@"--no-correction"]) {
        usesLanguageCorrection = NO;
        continue;
      }

      if ([arg isEqualToString:@"--min-confidence"]) {
        if (!nextValue) {
          JMFail(@"Missing value for --min-confidence.", 1);
        }
        double parsed = 0.0;
        if (!JMParseDoubleStrict(nextValue, &parsed) || !(parsed >= 0.0 && parsed <= 1.0)) {
          JMFail([NSString stringWithFormat:@"Invalid --min-confidence: %@ (expected 0.0..1.0)", nextValue], 1);
        }
        minConfidence = parsed;
        i += 1;
        continue;
      }
      if ([arg hasPrefix:@"--min-confidence="]) {
        NSString *raw = [arg substringFromIndex:[@"--min-confidence=" length]];
        double parsed = 0.0;
        if (!JMParseDoubleStrict(raw, &parsed) || !(parsed >= 0.0 && parsed <= 1.0)) {
          JMFail([NSString stringWithFormat:@"Invalid --min-confidence: %@ (expected 0.0..1.0)", raw], 1);
        }
        minConfidence = parsed;
        continue;
      }

      if ([arg isEqualToString:@"--no-observations"]) {
        emitObservations = NO;
        continue;
      }

      if ([arg hasPrefix:@"-"]) {
        JMFail([NSString stringWithFormat:@"Unknown option: %@", arg], 1);
      }

      // Positional image path (first non-flag argument).
      if (imagePath.length == 0) {
        imagePath = arg;
      }
    }

    if (imagePath.length == 0) {
      JMFail([NSString stringWithFormat:@"Image path is required.\n\n%@", JMUsage()], 1);
    }

    NSURL *url = [NSURL fileURLWithPath:imagePath];
    NSDate *startedAt = [NSDate date];

    JMDecodedImage decoded = JMDecodeImage(url, imagePath);
    NSInteger width = (NSInteger)decoded.width;
    NSInteger height = (NSInteger)decoded.height;

    VNRecognizeTextRequest * (^makeRequest)(BOOL) = ^VNRecognizeTextRequest * (BOOL forceCpu) {
      VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
      request.recognitionLevel = (level == JMOcrLevelAccurate)
        ? VNRequestTextRecognitionLevelAccurate
        : VNRequestTextRecognitionLevelFast;
      request.usesLanguageCorrection = usesLanguageCorrection;
      if (languages.count > 0) {
        request.recognitionLanguages = languages;
      }
      if (forceCpu) {
        JMApplyCpuComputeDeviceToRequest(request);
      }
      return request;
    };

    // Vision's URL-based handler does not reliably support WebP. Decode via ImageIO and pass a CGImageRef.
    VNImageRequestHandler *handler =
      [[VNImageRequestHandler alloc] initWithCGImage:decoded.image orientation:decoded.orientation options:@{}];
    NSError *visionError = nil;
    VNRecognizeTextRequest *request = makeRequest(NO);
    BOOL ok = [handler performRequests:@[request] error:&visionError];
    if (!ok || visionError) {
      const NSInteger code = visionError.code;
      const BOOL looksLikeCvPixelBufferFailure =
        (code == -6662) ||
        ([[visionError description] containsString:@"CVPixelBuffer"] == YES);

      if (looksLikeCvPixelBufferFailure) {
        visionError = nil;
        request = makeRequest(YES);
        ok = [handler performRequests:@[request] error:&visionError];
      }
    }
    CGImageRelease(decoded.image);
    decoded.image = NULL;
    if (!ok || visionError) {
      NSString *reason = visionError ? [visionError description] : @"performRequests returned false";
      JMFail([NSString stringWithFormat:@"Vision OCR failed: %@", reason], 1);
    }

    NSArray<VNRecognizedTextObservation *> *results = request.results ?: @[];
    NSMutableArray<NSDictionary *> *entries = [NSMutableArray arrayWithCapacity:results.count];

    for (VNRecognizedTextObservation *obs in results) {
      VNRecognizedText *candidate = [[obs topCandidates:1] firstObject];
      if (!candidate) {
        continue;
      }
      if ((double)candidate.confidence < minConfidence) {
        continue;
      }
      NSString *text = JMTrim(candidate.string);
      if (text.length == 0) {
        continue;
      }

      [entries addObject:@{
        @"text": text,
        @"confidence": @(candidate.confidence),
        @"bbox": [NSValue valueWithRect:NSRectFromCGRect(obs.boundingBox)],
      }];
    }

    [entries sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
      NSRect aboxNS = [a[@"bbox"] rectValue];
      NSRect bboxNS = [b[@"bbox"] rectValue];
      CGRect abox = NSRectToCGRect(aboxNS);
      CGRect bbox = NSRectToCGRect(bboxNS);
      double ay = abox.origin.y;
      double by = bbox.origin.y;
      if (fabs(ay - by) > 0.02) {
        return (ay > by) ? NSOrderedAscending : NSOrderedDescending;
      }
      double ax = abox.origin.x;
      double bx = bbox.origin.x;
      if (ax < bx) {
        return NSOrderedAscending;
      }
      if (ax > bx) {
        return NSOrderedDescending;
      }
      return NSOrderedSame;
    }];

    NSMutableArray<NSString *> *lines = [NSMutableArray array];
    for (NSDictionary *entry in entries) {
      NSString *text = entry[@"text"];
      if (![text isKindOfClass:[NSString class]] || text.length == 0) {
        continue;
      }
      NSArray<NSString *> *split = [text componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]];
      for (NSString *rawLine in split) {
        NSString *trimmed = JMTrim(rawLine);
        if (trimmed.length > 0) {
          [lines addObject:trimmed];
        }
      }
    }

    NSInteger durationMs = (NSInteger)llround([[NSDate date] timeIntervalSinceDate:startedAt] * 1000.0);
    NSDictionary *meta = @{
      @"engine": @"apple-vision",
      @"image_width": @(width),
      @"image_height": @(height),
      @"level": (level == JMOcrLevelFast) ? @"fast" : @"accurate",
      @"languages": languages ?: @[],
      @"uses_language_correction": @(usesLanguageCorrection),
      @"min_confidence": @(minConfidence),
      @"duration_ms": @(durationMs),
    };

    NSMutableDictionary *payload = [@{
      @"meta": meta,
      @"lines": lines,
    } mutableCopy];

    if (emitObservations) {
      NSMutableArray *observations = [NSMutableArray arrayWithCapacity:entries.count];
      for (NSDictionary *entry in entries) {
        NSRect rectNS = [entry[@"bbox"] rectValue];
        CGRect rect = NSRectToCGRect(rectNS);
        NSDictionary *bboxDict = @{
          @"x": @(rect.origin.x),
          @"y": @(rect.origin.y),
          @"w": @(rect.size.width),
          @"h": @(rect.size.height),
        };
        [observations addObject:@{
          @"text": entry[@"text"] ?: @"",
          @"confidence": entry[@"confidence"] ?: @(0),
          @"bbox": bboxDict,
        }];
      }
      payload[@"observations"] = observations;
    }

    NSError *jsonError = nil;
    NSJSONWritingOptions opts = 0;
    if (@available(macOS 10.15, *)) {
      opts |= NSJSONWritingWithoutEscapingSlashes;
    }
    NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:opts error:&jsonError];
    if (!data || jsonError) {
      JMFail([NSString stringWithFormat:@"Failed to serialize JSON: %@", jsonError ?: @"unknown error"], 1);
    }

    fwrite(data.bytes, 1, data.length, stdout);
    fwrite("\n", 1, 1, stdout);
    return 0;
  }
}
