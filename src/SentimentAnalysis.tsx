import * as nlp from 'node-nlp'

import React, { useState } from 'react'

const SentimentAnalysis = () => {

  const sentiment = new nlp.SentimentAnalyzer({ language: 'en' });
  // { score: 0.313,
  //   numWords: 3,
  //   numHits: 1,
  //   comparative: 0.10433333333333333,
  //   type: 'senticon',
  //   language: 'en' }

  // { score: -0.458,
  //   numWords: 3,
  //   numHits: 1,
  //   comparative: -0.15266666666666667,
  //   type: 'senticon',
  //   language: 'en' }
  const [text, setText] = useState('')
  return (
    <>
    <form>
      <h1>Sentiment Analysis</h1>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        />
      <button onClick={() => sentiment.getSentiment(text).then((result) => console.log(result))}>
        Analyze
      </button>
    </form>
      <p>
        {text}
      </p>
    </>
  )
}

export default SentimentAnalysis