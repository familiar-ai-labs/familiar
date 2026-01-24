const { ipcRenderer } = require('electron')

const icons = {
  success: `<svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
  </svg>`,
  error: `<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
  </svg>`,
  warning: `<svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>`,
  info: `<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>`
}

const toastEl = document.getElementById('toast')
const titleEl = document.getElementById('title')
const bodyEl = document.getElementById('body')
const iconEl = document.getElementById('icon')
const closeBtn = document.getElementById('close-btn')
const actionsEl = document.getElementById('actions')

ipcRenderer.on('toast-data', (_event, { title, body, type = 'info', size = 'compact', actions = [] }) => {
  titleEl.textContent = title || ''
  bodyEl.textContent = body || ''
  iconEl.innerHTML = icons[type] || icons.info

  // Apply size-specific styles
  if (size === 'large') {
    toastEl.classList.remove('items-center', 'max-w-[320px]')
    toastEl.classList.add('items-start', 'max-w-[420px]')
    bodyEl.classList.remove('truncate')
    bodyEl.classList.add('whitespace-pre-line', 'break-all', 'leading-relaxed')
    iconEl.classList.add('mt-0.5')
    closeBtn.classList.remove('hidden')
  } else {
    toastEl.classList.remove('items-start', 'max-w-[420px]')
    toastEl.classList.add('items-center', 'max-w-[320px]')
    bodyEl.classList.remove('whitespace-pre-line', 'break-all', 'leading-relaxed')
    bodyEl.classList.add('truncate')
    iconEl.classList.remove('mt-0.5')
    closeBtn.classList.add('hidden')
  }

  // Render action buttons
  actionsEl.innerHTML = ''
  if (actions.length > 0) {
    actionsEl.classList.remove('hidden')
    actions.forEach(({ label, action, data }) => {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.className =
        'px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors'
      btn.addEventListener('click', () => {
        ipcRenderer.send('toast-action', { action, data })
      })
      actionsEl.appendChild(btn)
    })
  } else {
    actionsEl.classList.add('hidden')
  }

  // IMPORTANT: after DOM updates & layout, measure actual height and ask main to resize the window
  // Two rAFs makes sure layout is fully computed after class changes + button insertion.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const rect = toastEl.getBoundingClientRect()
      const desiredHeight = Math.ceil(rect.height)
      ipcRenderer.send('toast-resize', { height: desiredHeight })
    })
  })
})

closeBtn.addEventListener('click', () => {
  ipcRenderer.send('toast-close')
})
