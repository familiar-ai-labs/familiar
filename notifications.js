const showNotification = ({ title, body }) => {
    try {
        const { Notification, app } = require('electron')
        if (!Notification || typeof Notification.isSupported !== 'function' || !Notification.isSupported()) {
            console.warn('Notifications not supported', { title, body })
            return false
        }

        const display = () => {
            try {
                const notification = new Notification({ title, body })
                notification.show()
                console.log('Notification shown', { title })
            } catch (error) {
                console.warn('Failed to show notification', { error, title })
            }
        }

        if (app && typeof app.isReady === 'function' && !app.isReady()) {
            console.warn('App not ready for notification yet', { title })
            app.once('ready', display)
            return true
        }

        display()
        return true
    } catch (error) {
        console.warn('Failed to show notification', { error, title, body })
        return false
    }
}

const showProviderExhaustedNotification = ({ source } = {}) => {
    console.warn('LLM provider exhausted', { source })
    return showNotification({
        title: 'LLM provider exhausted',
        body: 'Your LLM provider is rate limited. Please wait and try again.'
    })
}

module.exports = {
    showProviderExhaustedNotification
}
