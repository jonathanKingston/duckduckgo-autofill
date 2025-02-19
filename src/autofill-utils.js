let isApp = false
// Do not modify or remove the next line -- the app code will replace it with `isApp = true;`
// INJECT isApp HERE

const isDDGApp = /(iPhone|iPad|Android|Mac).*DuckDuckGo\/[0-9]/i.test(window.navigator.userAgent) || isApp

const isAndroid = isDDGApp && /Android/i.test(window.navigator.userAgent)

const isMobileApp = isDDGApp && !isApp

const DDG_DOMAIN_REGEX = new RegExp(/^https:\/\/(([a-z0-9-_]+?)\.)?duckduckgo\.com\/email/)

const isDDGDomain = () => window.location.href.match(DDG_DOMAIN_REGEX)

// Send a message to the web app (only on DDG domains)
const notifyWebApp = (message) => {
    if (isDDGDomain()) {
        window.postMessage(message, window.origin)
    }
}
/**
 * Sends a message and returns a Promise that resolves with the response
 * @param {{} | Function} msgOrFn - a fn to call or an object to send via postMessage
 * @param {String} expectedResponse - the name of the response
 * @returns {Promise<*>}
 */
const sendAndWaitForAnswer = (msgOrFn, expectedResponse) => {
    if (typeof msgOrFn === 'function') {
        msgOrFn()
    } else {
        window.postMessage(msgOrFn, window.origin)
    }

    return new Promise((resolve) => {
        const handler = e => {
            if (e.origin !== window.origin) return
            if (!e.data || (e.data && !(e.data[expectedResponse] || e.data.type === expectedResponse))) return

            resolve(e.data)
            window.removeEventListener('message', handler)
        }
        window.addEventListener('message', handler)
    })
}

// Access the original setter (needed to bypass React's implementation on mobile)
const originalSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set

/**
 * Ensures the value is set properly and dispatches events to simulate real user action
 * @param {HTMLInputElement} el
 * @param {string | number} val
 */
const setValueForInput = (el, val) => {
    // Avoid keyboard flashing on Android
    if (!isAndroid) {
        el.focus()
    }
    originalSet.call(el, val)

    const events = [
        new Event('keydown', {bubbles: true}),
        new Event('keyup', {bubbles: true}),
        new Event('input', {bubbles: true}),
        new Event('change', {bubbles: true})
    ]
    events.forEach((ev) => el.dispatchEvent(ev))
    // We call this again to make sure all forms are happy
    originalSet.call(el, val)
    el.blur()
}

/**
 * Selects an option of a select element
 * We assume Select is only used for dates, i.e. in the credit card
 * @param {HTMLSelectElement} el
 * @param {string | number} val
 */
const setValueForSelect = (el, val) => {
    for (const option of el.options) {
        // TODO: try to match localised month names
        const optValue = option.value || option.innerText
        if (optValue.includes(val)) {
            const events = [
                new Event('mousedown', {bubbles: true}),
                new Event('focus', {bubbles: true}),
                new Event('change', {bubbles: true}),
                new Event('mouseup', {bubbles: true}),
                new Event('click', {bubbles: true})
            ]
            option.selected = true
            // Events fire on the select el, not option
            events.forEach((ev) => el.dispatchEvent(ev))
            option.selected = true
            el.blur()
            return
        }
    }
}

/**
 * Sets or selects a value to a form element
 * @param {HTMLInputElement | HTMLSelectElement} el
 * @param {string | number} val
 */
const setValue = (el, val) => {
    if (el.nodeName === 'INPUT') setValueForInput(el, val)
    if (el.nodeName === 'SELECT') setValueForSelect(el, val)
}

/**
 * Use IntersectionObserver v2 to make sure the element is visible when clicked
 * https://developers.google.com/web/updates/2019/02/intersectionobserver-v2
 */
const safeExecute = (el, fn) => {
    const intObs = new IntersectionObserver((changes) => {
        for (const change of changes) {
            // Feature detection
            if (typeof change.isVisible === 'undefined') {
                // The browser doesn't support Intersection Observer v2, falling back to v1 behavior.
                change.isVisible = true
            }
            if (change.isIntersecting && change.isVisible) {
                fn()
            }
        }
        intObs.disconnect()
    }, {trackVisibility: true, delay: 100})
    intObs.observe(el)
}

/**
 * Gets the bounding box of the icon
 * @param {HTMLInputElement} input
 * @returns {{top: number, left: number, bottom: number, width: number, x: number, y: number, right: number, height: number}}
 */
const getDaxBoundingBox = (input) => {
    const {right: inputRight, top: inputTop, height: inputHeight} = input.getBoundingClientRect()
    const inputRightPadding = parseInt(getComputedStyle(input).paddingRight)
    const width = 30
    const height = 30
    const top = inputTop + (inputHeight - height) / 2
    const right = inputRight - inputRightPadding
    const left = right - width
    const bottom = top + height

    return {bottom, height, left, right, top, width, x: left, y: top}
}

/**
 * Check if a mouse event is within the icon
 * @param {MouseEvent} e
 * @param {HTMLInputElement} input
 * @returns {boolean}
 */
const isEventWithinDax = (e, input) => {
    const {left, right, top, bottom} = getDaxBoundingBox(input)
    const withinX = e.clientX >= left && e.clientX <= right
    const withinY = e.clientY >= top && e.clientY <= bottom

    return withinX && withinY
}

/**
 * Adds inline styles from a prop:value object
 * @param {HTMLElement} el
 * @param {Object<string, string>} styles
 */
const addInlineStyles = (el, styles) => Object.entries(styles)
    .forEach(([property, val]) => el.style.setProperty(property, val, 'important'))

/**
 * Removes inline styles from a prop:value object
 * @param {HTMLElement} el
 * @param {Object<string, string>} styles
 */
const removeInlineStyles = (el, styles) => Object.keys(styles)
    .forEach(property => el.style.removeProperty(property))

const ADDRESS_DOMAIN = '@duck.com'
/**
 * Given a username, returns the full email address
 * @param {string} address
 * @returns {string}
 */
const formatAddress = (address) => address + ADDRESS_DOMAIN

/**
 * Escapes any occurrences of &, ", <, > or / with XML entities.
 * @param {string} str The string to escape.
 * @return {string} The escaped string.
 */
function escapeXML (str) {
    const replacements = { '&': '&amp;', '"': '&quot;', "'": '&apos;', '<': '&lt;', '>': '&gt;', '/': '&#x2F;' }
    return String(str).replace(/[&"'<>/]/g, m => replacements[m])
}

module.exports = {
    isApp,
    isDDGApp,
    isAndroid,
    isMobileApp,
    DDG_DOMAIN_REGEX,
    isDDGDomain,
    notifyWebApp,
    sendAndWaitForAnswer,
    setValue,
    safeExecute,
    getDaxBoundingBox,
    isEventWithinDax,
    addInlineStyles,
    removeInlineStyles,
    ADDRESS_DOMAIN,
    formatAddress,
    escapeXML
}
