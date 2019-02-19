import kuromoji from 'kuromoji'
import dictionary from './dictionary'

const textInput = document.getElementById('text-input')
const analysisResultBox = document.getElementById('analysis-result')
const paraphrasesContainer = document.getElementById('paraphrase-container')

let tokenizer
let currentIntpuText
let paraphrases
let paraphraseTable
let activeParaphrases
let activeRestatements

kuromoji.builder({ dicPath: "public/dict" }).build(function (err, kuromojiTokenizer) {
	tokenizer = kuromojiTokenizer
	for (let category in dictionary)
		for (let i in dictionary[category])
			dictionary[category][i].keywords = dictionary[category][i].rawKeywords.map(keyword => tokenizer.tokenize(keyword)[0]).map(basicFormPronunciation)
	document.getElementById('loading-icon').classList.add('hidden')
	document.getElementById('main-content').classList.remove('hidden')
})

async function handleTextBox() {
	await new Promise(resolve => setTimeout(resolve))
	if (textInput.value === currentIntpuText) {
		handleParaphraseBox()
	} else {
		currentIntpuText = textInput.value
		analysis()
	}
}

function handleParaphraseBox() {
	Array.from(document.querySelectorAll('#paraphrase-container > :not(#paraphrase-template)')).forEach(element => element.remove())
	if (textInput.selectionStart === textInput.selectionEnd && paraphraseTable[textInput.selectionStart]) {
		activeParaphrases = paraphraseTable[textInput.selectionStart]
		activeRestatements = []
		activeParaphrases.forEach(paraphrase => activeRestatements = [...activeRestatements, ...paraphrase.restatements])
		updateParaphraseBox()
	} else {
		activeParaphrases = undefined
		activeRestatements = undefined
	}
}

function updateParaphraseBox() {
	let restatementCount = 0
	activeParaphrases.forEach(paraphrase => {
		const paraphraseBox = document.getElementById('paraphrase-template').cloneNode(true)
		paraphraseBox.removeAttribute('id')
		paraphraseBox.querySelector('.title').innerText = paraphrase.original
		paraphraseBox.querySelector('.content').innerText = paraphrase.restatements.map(line => `${++restatementCount}> ${line}`).join('\n')
		paraphraseBox.classList.remove('hidden')
		paraphrasesContainer.appendChild(paraphraseBox)
	})

	const highlightBox = document.getElementById(`highlight-${activeParaphrases[0].highlightIndex}`)
	const boundingRect = highlightBox.getBoundingClientRect()
	paraphrasesContainer.style.left = paraphrasesContainer.style.right = paraphrasesContainer.style.top = paraphrasesContainer.style.bottom = 'auto'
	if (boundingRect.left < window.innerWidth / 2)
		paraphrasesContainer.style.left = boundingRect.left + 'px'
	else
		paraphrasesContainer.style.right = window.innerWidth - boundingRect.right + 'px'
	if (boundingRect.top < window.innerHeight / 2)
		paraphrasesContainer.style.top = boundingRect.bottom + 'px'
	else
		paraphrasesContainer.style.bottom = window.innerHeight - boundingRect.top + 'px'
}

function analysis() {
	paraphrases = []
	paraphraseTable = []
	let highlightCount = 0
	let html = ''
	tokenizer.tokenize(currentIntpuText).forEach(token => {
		let paraphraseFound = false
		if ('助動詞' !== token.pos && '助詞' !== token.pos) {
			for (let category in dictionary) {
				for (let i in dictionary[category].filter(item => -1 !== item.keywords.indexOf(basicFormPronunciation(token)))) {
					paraphraseFound = true
					const paraphrase = {
						...dictionary[category][i],
						text: token.surface_form,
						position: token.word_position - 1,
						highlightIndex: highlightCount,
					}
					paraphrases.push(paraphrase)
					for (let i = 0; i <= paraphrase.text.length; i++) {
						const pos = token.word_position - 1 + i
						if (undefined === paraphraseTable[pos])
							paraphraseTable[pos] = []
						paraphraseTable[pos].push(paraphrase)
					}
				}
			}
		}
		if (paraphraseFound) {
			html += `<span id="highlight-${highlightCount}">${escapeHtml(token.surface_form)}</span>`;
			highlightCount++
		} else {
			html += escapeHtml(token.surface_form)
		}
	})
	analysisResultBox.innerHTML = html
}

textInput.addEventListener('click', handleTextBox, false)
textInput.addEventListener('keydown', handleTextBox, false)
textInput.addEventListener('paste', handleTextBox, false)
document.addEventListener('keydown', event => {
	if (!activeRestatements || !event.altKey || 48 > event.keyCode || 57 < event.keyCode)
		return
	const paraphrase = activeParaphrases[0]
	const leftPart = currentIntpuText.substr(0, paraphrase.position)
	const rightPart = currentIntpuText.substr(paraphrase.position + paraphrase.text.length)
	textInput.value = `${leftPart}〔${activeRestatements[event.keyCode - 49]}〕${rightPart}`
	textInput.focus()
	textInput.selectionEnd = paraphrase.position
	handleTextBox()
})

function basicFormPronunciation(token) {
	return tokenizer.tokenize(token.basic_form)[0].pronunciation
}

function escapeHtml(unsafe) {
	return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/ /g, '&nbsp;').replace(/\n/g, '<br>')
}