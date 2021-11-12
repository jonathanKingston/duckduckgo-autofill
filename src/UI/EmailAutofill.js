const {
    isApp,
    formatDuckAddress,
    escapeXML,
    isTopFrame
} = require('../autofill-utils')
const {
    wkSend
} = require('../appleDeviceUtils/appleDeviceUtils')
const Tooltip = require('./Tooltip')

class EmailAutofill extends Tooltip {
    constructor (input, associatedForm, Interface) {
        super(input, associatedForm, Interface)

        this.addresses = this.interface.getLocalAddresses()

        const includeStyles = isApp
            ? `<style>${require('./styles/autofill-tooltip-styles.js')}</style>`
            : `<link rel="stylesheet" href="${chrome.runtime.getURL('public/css/autofill.css')}" crossorigin="anonymous">`

        // TODO
        const isDesktop = true
        const desktopClass = isDesktop ? 'desktop' : ''

        this.shadow.innerHTML = `
${includeStyles}
<div class="wrapper wrapper--email ${desktopClass}">
    <div class="tooltip tooltip--data" hidden>
        <button class="tooltip__button tooltip__button--email js-use-personal">
            <span class="tooltip__button--email__primary-text">
                Use <span class="js-address">${formatDuckAddress(escapeXML(this.addresses.personalAddress))}</span>
            </span>
            <span class="tooltip__button--email__secondary-text">Blocks email trackers</span>
        </button>
        <button class="tooltip__button tooltip__button--email js-use-private">
            <span class="tooltip__button--email__primary-text">Use a Private Address</span>
            <span class="tooltip__button--email__secondary-text">Blocks email trackers and hides your address</span>
        </button>
    </div>
</div>`
        this.wrapper = this.shadow.querySelector('.wrapper')
        this.tooltip = this.shadow.querySelector('.tooltip')
        this.usePersonalButton = this.shadow.querySelector('.js-use-personal')
        this.usePrivateButton = this.shadow.querySelector('.js-use-private')
        this.addressEl = this.shadow.querySelector('.js-address')

        this.updateAddresses = (addresses) => {
            if (addresses) {
                this.addresses = addresses
                this.addressEl.textContent = formatDuckAddress(addresses.personalAddress)
            }
        }
        function fillForm (address) {
            const formattedAddress = formatDuckAddress(address)
            if (isTopFrame) {
                wkSend('selectedDetail', { credential: formattedAddress })
            } else {
                this.associatedForm.autofillEmail(formattedAddress)
            }
        }
        this.registerClickableButton(this.usePersonalButton, () => {
            fillForm(this.addresses.personalAddress)
        })
        this.registerClickableButton(this.usePrivateButton, () => {
            const email = this.addresses.privateAddress
            this.interface.refreshAlias()
            fillForm(email)
        })

        // Get the alias from the extension
        this.interface.getAddresses().then(this.updateAddresses)

        this.init()
    }
}

module.exports = EmailAutofill
