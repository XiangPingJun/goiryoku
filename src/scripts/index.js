import kuromoji from 'kuromoji'
import dictionary from './dictionary'

let tokenizer

new Vue({
	el: '#app',
	data: {
		inputTokens: null,
		cursorPosition: 0,
		paraphrases: null,
		paraphraseTable: null,
		paraphrasesContainerStyle: null,
		activeSubMenuIndex: null,
		inputText: '',
		ready: false,
	},
	created() {
		kuromoji.builder({ dicPath: "public/dict" }).build((err, kuromojiTokenizer) => {
			this.ready = true
			tokenizer = kuromojiTokenizer
		})
		document.addEventListener('keydown', this.onKeyDown)
	},
	beforeDestroy() {
		document.removeEventListener('keydown', this.onKeyDown)
	},
	watch: {
		inputText() {
			this.analysis()
			this.handleParaphraseBox()
		},
	},
	computed: {
		subMenuOptions() {
			if (null == this.activeSubMenuIndex)
				return null
			return dictionary[Object.keys(dictionary)[this.activeSubMenuIndex]].map(item => item.keywords[0])
		},
		activeParaphrases() {
			if (!this.paraphraseTable || !this.paraphraseTable[this.cursorPosition])
				return null
			let restatementCount = 0
			return this.paraphraseTable[this.cursorPosition].map(paraphrase => (
				{
					...paraphrase,
					title: paraphrase.original,
					candidates: paraphrase.restatements.map(line => `${(++restatementCount).toString(36)}> ${line}`),
				}
			))
		},
		activeRestatements() {
			if (!this.activeParaphrases)
				return null
			let restatements = []
			this.activeParaphrases.forEach(paraphrase => restatements = [...restatements, ...paraphrase.restatements])
			return restatements
		},
		dictionary() {
			return dictionary
		},
	},
	methods: {
		onKeyDown(event) {
			if (event.code.match(/^Arrow/)) {
				this.handleParaphraseBox()
			} else if (event.altKey) {
				const keyNumber = this.keyToNumber(event.code)
				if (undefined === keyNumber)
					return
				event.preventDefault()
				const index = keyNumber - 1
				if (this.activeRestatements) {
					this.applyRestatement(index)
				} else if (this.subMenuOptions) {
					if (index === this.subMenuOptions.length) {
						this.activeSubMenuIndex = null
					} else {
						this.applyKeyword(index)
					}
				} else if (Object.keys(dictionary)[index]) {
					this.activeSubMenuIndex = index
				}
			}
		},
		async applyKeyword(index) {
			if (!this.subMenuOptions[index])
				return
			const leftPart = this.inputText.substr(0, this.cursorPosition)
			const rightPart = this.inputText.substr(this.cursorPosition)
			this.inputText = `${leftPart}${this.subMenuOptions[index]}${rightPart}`
			this.activeSubMenuIndex = null
			await new Promise(resolve => setTimeout(resolve))
			this.$refs.textInput.focus()
			this.$refs.textInput.selectionEnd = this.cursorPosition
		},
		async applyRestatement(index) {
			if (!this.activeRestatements[index])
				return
			const paraphrase = this.activeParaphrases[0]
			const leftPart = this.inputText.substr(0, paraphrase.position + paraphrase.text.length)
			const rightPart = this.inputText.substr(paraphrase.position + paraphrase.text.length)
			this.inputText = `${leftPart}〔${this.activeRestatements[index]}〕${rightPart}`
			await new Promise(resolve => setTimeout(resolve))
			this.$refs.textInput.focus()
			this.$refs.textInput.selectionEnd = paraphrase.position
		},
		async handleParaphraseBox() {
			await new Promise(resolve => setTimeout(resolve))
			if (this.$refs.textInput.selectionStart === this.$refs.textInput.selectionEnd)
				this.cursorPosition = this.$refs.textInput.selectionStart
			if (!this.activeParaphrases)
				return
			const highlightBox = this.$refs.highlight[this.activeParaphrases[0].highlightIndex]
			const boundingRect = highlightBox.getBoundingClientRect()
			this.paraphrasesContainerStyle = {}
			if (boundingRect.left < window.innerWidth / 2)
				this.paraphrasesContainerStyle.left = boundingRect.left + 'px'
			else
				this.paraphrasesContainerStyle.right = window.innerWidth - boundingRect.right + 'px'
			if (boundingRect.top < window.innerHeight / 2)
				this.paraphrasesContainerStyle.top = boundingRect.bottom + 'px'
			else
				this.paraphrasesContainerStyle.bottom = window.innerHeight - boundingRect.top + 'px'
		},
		analysis() {
			this.paraphrases = []
			this.paraphraseTable = []
			this.inputTokens = []
			let highlightCount = 0
			tokenizer.tokenize(this.inputText).forEach(token => {
				let paraphraseFound = false
				if ('助動詞' !== token.pos && '助詞' !== token.pos) {
					for (let category in dictionary) {
						for (let i in dictionary[category]) {
							if (!dictionary[category][i].keywords.find(keyword => -1 !== keyword.indexOf(token.basic_form)))
								continue
							paraphraseFound = true
							const paraphrase = {
								...dictionary[category][i],
								text: token.surface_form,
								position: token.word_position - 1,
								highlightIndex: highlightCount,
							}
							this.paraphrases.push(paraphrase)
							for (let i = 0; i <= paraphrase.text.length; i++) {
								const pos = token.word_position - 1 + i
								if (undefined === this.paraphraseTable[pos])
									this.paraphraseTable[pos] = []
								this.paraphraseTable[pos].push(paraphrase)
							}
						}
					}
				}
				if (paraphraseFound) {
					this.inputTokens.push({
						type: 'highlight',
						text: token.surface_form,
						id: highlightCount,
					})
					highlightCount++
				} else {
					this.inputTokens.push({
						type: 'text',
						text: token.surface_form,
					})
				}
			})
		},
		basicFormPronunciation(token) {
			return tokenizer.tokenize(token.basic_form)[0].pronunciation
		},
		keyToNumber(code) {
			let match = code.match(/^(Digit|Numpad)([\d])/)
			if (match)
				return match[2]
			match = code.match(/^Key([a-z])/i)
			if (match)
				return parseInt(match[1], 36)
			return undefined
		},
	},
})