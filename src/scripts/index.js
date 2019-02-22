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
					candidates: paraphrase.restatements.map(line => (
						{
							index: restatementCount++,
							text: line,
						}
					)),
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
		isPC() {
			return !mobileAndTabletcheck()
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
					for (let i in token.surface_form) {
						if (' ' == token.surface_form[i])
							this.inputTokens.push({ type: 'space' })
						else if ('\n' == token.surface_form[i])
							this.inputTokens.push({ type: 'line-break' })
						else
							this.inputTokens.push({
								type: 'text',
								text: token.surface_form[i],
							})
					}
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

function mobileAndTabletcheck() {
	var check = false;
	(function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
	return check;
};