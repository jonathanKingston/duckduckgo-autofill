function setupFakeForm () {
    let main = document.querySelector('main')
    // TODO hey we're a PoC let's just fake the code to get it working
    let fakeInput = document.createElement('input')
    fakeInput.type = 'email'
    fakeInput.name = 'email'
    fakeInput.autocomplete = 'email'
    let fakeForm = document.createElement('form')
    fakeForm.appendChild(fakeInput)
    main.appendChild(fakeForm)
    return {fakeInput, fakeForm}
}

function init () {
    const {fakeInput, fakeForm} = setupFakeForm()
    const DeviceInterface = require('./DeviceInterface')
    // TODO
    function triggerFormSetup () {
        const {getOrCreateParentFormInstance} = require('./scanForInputs')
        const parentFormInstance = getOrCreateParentFormInstance(fakeInput, fakeForm, DeviceInterface)
        console.log('triggerFormSetup', fakeInput, fakeInput.form, parentFormInstance)
        DeviceInterface.setActiveForm(fakeInput, parentFormInstance)
    }
    window.addEventListener('InitComplete', triggerFormSetup)
    // const EmailAutofill = require('./UI/EmailAutofill')
    /*
    const {
        wkSend
    } = require('./appleDeviceUtils/appleDeviceUtils')
*/
    // const DataAutofill = require('./UI/DataAutofill')

    require('./init')
    // let af = new EmailAutofill(fakeInput, fakeForm, DeviceInterface)
    // console.log(af)
    /*
    fakeForm.style.visibility = "hidden" // TODO have a way to handle no input element instead
    fakeForm.style.display = "none"
     */

    setTimeout(triggerFormSetup, 4000)

/*
    let button = document.querySelector('button')
    button.addEventListener('click', () => {
        // eslint-disable-next-line no-undef
        wkSend('selectedDetail', { credential: 'jkt@duck.com' })
    })
 */
}
window.addEventListener('load', init)
