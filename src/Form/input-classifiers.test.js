const fs = require('fs')
const path = require('path')

const {getUnifiedExpiryDate} = require('./formatters')
const {scanForInputs} = require('../scanForInputs')
const {Matching, getInputSubtype} = require('./matching')
const {matchingConfiguration} = require('./matching-configuration')
const {Form} = require('./Form')
const InterfacePrototype = require('../DeviceInterface/InterfacePrototype')

const CSS_MATCHERS_LIST = matchingConfiguration.matchers.lists['cc'].map(matcherName => {
    return matchingConfiguration.matchers.fields[matcherName]
})

/**
 * @param {HTMLInputElement} el
 * @param {HTMLFormElement} form
 * @returns {string|undefined}
 */
const getCCFieldSubtype = (el, form) => {
    const matching = new Matching(matchingConfiguration)
    return matching.subtypeFromMatchers(CSS_MATCHERS_LIST, el, form)
}

const renderInputWithLabel = () => {
    const input = document.createElement('input')
    input.id = 'inputId'
    const label = document.createElement('label')
    label.setAttribute('for', 'inputId')
    const formElement = document.createElement('form')
    formElement.append(input, label)
    document.body.append(formElement)
    const form = new Form(formElement, input, new InterfacePrototype())
    return { input, label, formElement: formElement, form }
}

const testRegexForCCLabels = (cases) => {
    Object.entries(cases).forEach(([expectedType, arr]) => {
        arr.forEach(({text, shouldMatch = true}) => {
            it(`"${text}" should ${shouldMatch ? '' : 'not '}match regex for ${expectedType}`, () => {
                const {input, label, formElement} = renderInputWithLabel()
                label.textContent = text

                const subtype = getCCFieldSubtype(input, formElement)
                if (shouldMatch) {
                    expect(subtype).toBe(expectedType)
                } else {
                    expect(subtype).not.toBe(expectedType)
                }
            })
        })
    })
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('Input Classifiers', () => {
    const ccLabelTestCases = {
        cardName: [
            {text: 'credit card name'},
            {text: 'name on card'},
            {text: 'card holder'},
            {text: 'card owner'},
            {text: 'card number', shouldMatch: false}
        ],
        cardNumber: [
            {text: 'Credit Card Number'},
            {text: 'number on card'},
            {text: 'card owner', shouldMatch: false}
        ],
        expirationMonth: [
            {text: 'expiry month'},
            {text: 'expiration month'},
            {text: 'exp month'},
            {text: 'Credit Card Number', shouldMatch: false},
            {text: 'expiry year', shouldMatch: false},
            {text: 'expiration year', shouldMatch: false},
            {text: 'exp year', shouldMatch: false},
            {text: 'card expiry yy', shouldMatch: false}
        ],
        expirationYear: [
            {text: 'expiry year'},
            {text: 'expiration year'},
            {text: 'exp year'},
            {text: 'card expiry yy'},
            {text: 'Credit Card Number', shouldMatch: false},
            {text: 'expiry month', shouldMatch: false},
            {text: 'expiration month', shouldMatch: false},
            {text: 'exp month', shouldMatch: false},
            {text: 'card expiry mo', shouldMatch: false}
        ]
    }
    testRegexForCCLabels(ccLabelTestCases)

    describe('Unified Expiration Date', () => {
        describe.each([
            { text: 'mm-yyyy', expectedResult: '08-2025' },
            { text: 'mm/yyyy', expectedResult: '08/2025' },
            { text: '__-____', expectedResult: '08-2025' },
            { text: 'mm-yy', expectedResult: '08-25' },
            { text: 'i.e. 10-2022', expectedResult: '08-2025' },
            { text: 'MM-AAAA', expectedResult: '08-2025' },
            { text: 'mm_jj', expectedResult: '08_25' },
            { text: 'mm.yy', expectedResult: '08.25' },
            { text: 'mm - yy', expectedResult: '08-25' },
            { text: 'mm yy', expectedResult: '08 25' },
            { text: 'ie: 08.22', expectedResult: '08.25' }
        ])('when checking for "$text"', ({ text, expectedResult }) => {
            let elements

            beforeEach(() => {
                elements = renderInputWithLabel()
                elements.input.autocomplete = 'cc-exp'
            })

            it('matches for placeholder text', () => {
                elements.input.placeholder = text

                expect(getCCFieldSubtype(elements.input, elements.form)).toBe('expiration')
                expect(getUnifiedExpiryDate(elements.input, 8, 2025, elements.form)).toBe(expectedResult)
            })

            it('matches for label text', () => {
                elements.label.textContent = text

                expect(getCCFieldSubtype(elements.input, elements.form)).toBe('expiration')
                expect(getUnifiedExpiryDate(elements.input, 8, 2025, elements.form)).toBe(expectedResult)
            })
        })
    })
})

const testCases = require('./test-cases/index')
describe.each(testCases)('Test $html fields', (testCase) => {
    const { html, expectedFailures = [], title = '__test__' } = testCase

    const testTextString = expectedFailures.length > 0
        ? `should contain ${expectedFailures.length} known failure(s): ${JSON.stringify(expectedFailures)}`
        : `should NOT contain failures`

    it(testTextString, () => {
        const testContent = fs.readFileSync(path.resolve(__dirname, './test-cases', html), 'utf-8')

        document.body.innerHTML = testContent
        document.title = title

        scanForInputs(new InterfacePrototype(), new Map()).findEligibleInputs(document)

        /**
         * @type {NodeListOf<HTMLInputElement>}
         */
        const manuallyScoredFields = document.querySelectorAll('[data-manual-scoring]')

        const scores = Array.from(manuallyScoredFields).map(field => {
            const { manualScoring, ddgInputtype, ...rest } = field.dataset
            // @ts-ignore
            field.style = ''
            return {
                attrs: {
                    name: field.name,
                    id: field.id,
                    dataset: rest
                },
                html: field.outerHTML,
                inferredType: getInputSubtype(field),
                manualScore: field.getAttribute('data-manual-scoring')
            }
        })
        let bad = scores.filter(x => x.inferredType !== x.manualScore)
        let failed = bad.map(x => x.manualScore)

        if (bad.length !== expectedFailures.length) {
            for (let score of bad) {
                console.log(
                    'manualType:   ' + JSON.stringify(score.manualScore),
                    '\ninferredType: ' + JSON.stringify(score.inferredType),
                    '\nid:          ', JSON.stringify(score.attrs.id),
                    '\nname:        ', JSON.stringify(score.attrs.name),
                    '\nHTML:        ', score.html
                )
            }
        }
        expect(failed).toStrictEqual(expectedFailures)
    })
})
