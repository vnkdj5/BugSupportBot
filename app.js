/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable no-inner-declarations */
/* eslint-disable require-jsdoc */
/* eslint-disable no-var */
/* eslint-disable prettier/prettier */
/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

'use strict';

require('dotenv').config({
  silent: true
});

const express = require('express'); // app server
const bodyParser = require('body-parser'); // parser for post requests
const numeral = require('numeral');
const upperBound = '1gb';
const request = require('request');

const fs = require('fs'); // file system for loading JSON
const CombinedStream = require('combined-stream');
const AssistantV1 = require('watson-developer-cloud/assistant/v1');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');
const ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');

const speechToText = new SpeechToTextV1({
  iam_apikey: 'kT_MxMpOQYA535Ef2R6tDezyRJFJkmhnQW6hWPK7tzxs',
  url: 'https://gateway-lon.watsonplatform.net/speech-to-text/api'
});
const assistant = new AssistantV1({ version: '2018-02-16' });
const discovery = new DiscoveryV1({ version: '2018-03-05' });
const nlu = new NaturalLanguageUnderstandingV1({ version: '2018-03-16' });
const toneAnalyzer = new ToneAnalyzerV3({ version: '2017-09-21' });

const bugbotServices = require('./bugbot_services');
const WatsonDiscoverySetup = require('./lib/watson-discovery-setup');
const WatsonAssistantSetup = require('./lib/watson-assistant-setup');


const LOOKUP_ERROR = 'error';
const LOOKUP_THEORY = 'theory';
const LOOKUP_INSTALL = 'install';
const DEFAULT_NAME = 'watson-banking-chatbot';
const DISCOVERY_ACTION = 'rnr'; // Replaced RnR w/ Discovery but Assistant action is still 'rnr'.
const DISCOVERY_DOCS = [
  './data/discovery/docs/Android  Studio.pdf',
  './data/discovery/docs/Anaconda.pdf',
  './data/discovery/docs/Node JS  _.pdf',
  './data/discovery/docs/Python .pdf',
  './data/discovery/docs/GO.pdf',
  './data/discovery/docs/IBM-Cloud .pdf',
  './data/discovery/docs/Anaconda.pdf',
  './data/discovery/docs/MAVEN.pdf',
  './data/discovery/docs/Missing Jar Files .pdf'

];

const LOOKUP_BALANCE = 'balance';
const LOOKUP_TRANSACTIONS = 'transactions';
const LOOKUP_5TRANSACTIONS = '5transactions';

const app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true,limit: upperBound }))

// setupError will be set to an error message if we cannot recover from service setup or init error.
let setupError = '';

let discoveryParams; // discoveryParams will be set after Discovery is validated and setup.
const discoverySetup = new WatsonDiscoverySetup(discovery);
const discoverySetupParams = { default_name: DEFAULT_NAME, documents: DISCOVERY_DOCS };
discoverySetup.setupDiscovery(discoverySetupParams, (err, data) => {
  if (err) {
    handleSetupError(err);
  } else {
    console.log('Discovery is ready!');
    discoveryParams = data;
  }
});
// wrap a request in an promise
function downloadPage(url) {
  return new Promise((resolve, reject) => {
      request(url, (error, response, body) => {
          /* if (error) reject(error);
          if (response.statusCode != 200) {
              reject('Invalid status code <' + response.statusCode + '>');
          } */
          if (!error && response.statusCode == 200) {
            resolve(body);
        }
          
      });
  });
}
let workspaceID; // workspaceID will be set when the workspace is created or validated.
const assistantSetup = new WatsonAssistantSetup(assistant);
const workspaceJson = JSON.parse(fs.readFileSync('data/conversation/workspaces/bugbot.json'));
const assistantSetupParams = { default_name: DEFAULT_NAME, workspace_json: workspaceJson };
assistantSetup.setupAssistantWorkspace(assistantSetupParams, (err, data) => {
  if (err) {
    handleSetupError(err);
  } else {
    console.log('Watson Assistant is ready!');
    workspaceID = data;
    // console.log("data",data);
  }
});

// Endpoint to be called from the client side
app.post('/api/message', function(req, res) {
  if (setupError) {
    return res.json({ output: { text: 'The app failed to initialize properly. Setup and restart needed.' + setupError } });
  }

  if (!workspaceID) {
    return res.json({
      output: {
        text: 'Assistant initialization in progress. Please try again.'
      }
    });
  }

  bugbotServices.getQueryInfo(1001, function(err, person) {
    if (err) {
      console.log('Error occurred while getting person data ::', err);
      return res.status(err.code || 500).json(err);
    }

    const payload = {
      workspace_id: workspaceID,
      context: {
        person: person
      },
      input: {}
    };

    // common regex patterns
    // const regadhaar = /^\d{12}$/;
    // const regmobile = /^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[789]\d{9}$/;
    if (req.body) {
      if (req.body.input) {
        let inputstring = req.body.input.text;
        console.log('input string ', inputstring);
       /*  const words = inputstring.split(' ');
        // console.log('words ', words);
        inputstring = '';
        for (let i = 0; i < words.length; i++) {
         /*  if (regpan.test(words[i]) === true) {
            // const value = words[i];
            words[i] = '1111111111';
          } 
          inputstring += words[i] + ' ';
        }
        // words.join(' '); */
        inputstring = inputstring.trim();
        console.log('After inputstring ', inputstring);
        // payload.input = req.body.input;
        payload.input.text = inputstring;
      }
      if (req.body.context) {
        // The client must maintain context/state
        payload.context = req.body.context;
      }
    }
    callAssistant(payload);
  });

  /**
   * Send the input to the Assistant service.
   * @param payload
   */
  function callAssistant(payload) {
    const queryInput = JSON.stringify(payload.input);

    const toneParams = {
      tone_input: { text: queryInput },
      content_type: 'application/json'
    };
    toneAnalyzer.tone(toneParams, function(err, tone) {
      let toneAngerScore = '';
      if (err) {
        console.log('Error occurred while invoking Tone analyzer. ::', err);
      } 
      else 
      {
        // console.log(JSON.stringify(tone, null, 2));
        const emotionTones = tone.document_tone.tones;

        const len = emotionTones.length;
        for (let i = 0; i < len; i++) {
          if (emotionTones[i].tone_id === 'anger') {
          //  console.log('Input = ', queryInput);
          //  console.log('emotion_anger score = ', 'Emotion_anger', emotionTones[i].score);
            toneAngerScore = emotionTones[i].score;
            break;
          }
        }
      }

      payload.context['tone_anger_score'] = toneAngerScore;

      if (payload.input.text != '') {
        // console.log('input text payload = ', payload.input.text);
        const parameters = {
          text: payload.input.text,
          features: {
            entities: {
              emotion: true,
              sentiment: true,
              limit: 2
            },
            keywords: {
              emotion: true,
              sentiment: true,
              limit: 2
            }
          }
        };

        nlu.analyze(parameters, function(err, response) {
          if (err) {
            console.log('error:', err);
          } else {
            const nluOutput = response;

            payload.context['nlu_output'] = nluOutput;
            console.log('NLU = ', nluOutput);
            // identify location
            const entities = nluOutput.entities;
            // console.log('\nCurrent Entitiies',nluOutput.entities);
            /* let location = entities.map(function(entry) {
              if (entry.type == 'Location') {
                return entry.text;
              }
            });
            location = location.filter(function(entry) {
              if (entry != null) {
                return entry;
              }
            });
            if (location.length > 0) {
              payload.context['Location'] = location[0];
              console.log('Location = ', payload.context['Location']);
            } else {
              payload.context['Location'] = '';
            } */
          }

          assistant.message(payload, function(err, data) {
            if (err) {
              return res.status(err.code || 500).json(err);
            } else {
              console.log('assistant.message 1 :: ', JSON.stringify(data));
              // lookup actions
              checkForLookupRequests(data, function(err, data) {
                if (err) {
                  return res.status(err.code || 500).json(err);
                } else {
                  return res.json(data);
                }
              });
            }
          });
        });
      } else {
        assistant.message(payload, function(err, data) {
          if (err) {
            return res.status(err.code || 500).json(err);
          } else {
            console.log('assistant.message :: ', JSON.stringify(data));
            return res.json(data);
          }
        });
      }
    });
  }
});

// message api terminated
/**
 * Looks for actions requested by Assistant service and provides the requested data.
 */
function checkForLookupRequests(data, callback) {
  console.log('checkForLookupRequests');
  console.log('DATA ==> ',data);
  /*
  Requested data
  console.log("data*****",data.context.lang);
  console.log("data*****",data.context.error_name);
  console.log("data*****",data.context.username);
  Response data
  data.context.res = "Ola there";
  */
 console.log('************** Discovery1');
  if (data.context && data.context.action && data.context.action.lookup && data.context.action.lookup != 'complete')
  {
    const payload = {
      workspace_id: workspaceID,
      context: data.context,
      input: data.input
    };
    console.log('************** Discovery2');
    // Assistant requests a data lookup action
    if (data.context.action.lookup === LOOKUP_ERROR || data.context.action.lookup === LOOKUP_THEORY || data.context.action.lookup === LOOKUP_INSTALL||data.context.action.lookup === 'discovery') {
      console.log('Lookup Error requested');
      //console.log('\nCurrent Context',data.context);
      console.log('\n\n\n');
      async function myBackEndLogic(param1,param2) {
        try {
            const html = await downloadPage('https://www.googleapis.com/customsearch/v1?key=AIzaSyBnAGY3RuT_Wc2nS3kaMbs0dKFm4Goi3mQ&cx=017576662512468239146:omuauf_lfve&q='+param1+'+'+param2)
           let pagejson= JSON.parse(html);
          //  console.log('Mypage result ==> ',pagejson.items[0]);
            data.output.text.push(pagejson.items[0].htmlSnippet);
            data.output.text.push('<a href="'+pagejson.items[0].link+'" target="_blank">More Info</a>');
            data.context.action.lookup='';
            payload.context = {};
            data.context= {};
            callback(null, data);
            // try downloading an invalid url
            //await downloadPage('http://      .com')
        } catch (error) {
            console.error('ERROR:');
            console.error(error);
        }
    }

      if(data.context.action.lookup === LOOKUP_ERROR)
      {
        let langName=data.context.lang;
        let errorName=data.context.error_name;
        myBackEndLogic(errorName,langName);
        data.context.errorName = '';
        data.context.langName = '';


      }
      else if(data.context.action.lookup === LOOKUP_THEORY)
      {
       // let langName=data.context.lang;
        let concept=data.context.concept;
        myBackEndLogic('what+is',data.context.concept);
        data.context.concept = '';
        data.context.errorName = '';
        data.context.langName = '';
      }
      else if(data.context.action.lookup === LOOKUP_INSTALL)
      {
        let langName=data.context.lang;
        //let concept=data.context.concept;
        myBackEndLogic('install',langName);
        data.context.lang = '';
        data.context.errorName = '';
        data.context.concept = '';

      }
      else if(data.context.action.lookup === "discovery")
      {

        console.log('************** Discovery *************** InputText : ' + payload.input.text);
        let discoveryResponse = '';
        if (!discoveryParams) {
          console.log('Discovery is not ready for query.');
          discoveryResponse = 'Sorry, currently I do not have a response. Discovery initialization is in progress. Please try again later.';
          if (data.output.text) {
            data.output.text.push(discoveryResponse);
            console.log('************** Discovery3'+discoveryResponse);
          }
          // Clear the context's action since the lookup and append was attempted.
          data.context.action = {};
          console.log('************** Discovery4 : data.output.text'+data.output.text);
          callback(null, data);
          // Clear the context's action since the lookup was attempted.
          payload.context.action = {};
        } else {
          const queryParams = {
            natural_language_query: payload.input.text,
            passages: true
          };
          Object.assign(queryParams, discoveryParams);
          discovery.query(queryParams, (err, searchResponse) => {
            console.log('************** Discovery5',searchResponse);         
            discoveryResponse = 'Sorry, currently I do not have a response. Our Customer representative will get in touch with you shortly.';
            if (err) {
              console.error('Error searching for documents: ' + err);
            } else if (searchResponse.passages.length > 0) {
              const bestPassage = searchResponse.passages[0];
              console.log('Passage score: ', bestPassage.passage_score);
              console.log('Passage text: ', bestPassage.passage_text);
  
              // Trim the passage to try to get just the answer part of it.
              const lines = bestPassage.passage_text.split('\n');
              let bestLine;
              let questionFound = false;
              for (let i = 0, size = 1; i < size; i++) {
                const line = lines[i].trim();
                if (!line) {
                  continue; // skip empty/blank lines
                }
                if (line.includes('?') || line.includes('<h1')) {
                  // To get the answer we needed to know the Q/A format of the doc.
                  // Skip questions which either have a '?' or are a header '<h1'...
                  questionFound = true;
                  continue;
                }
                bestLine = line; // Best so far, but can be tail of earlier answer.
                console.log('************** Discovery : best line'+bestLine);
                if (questionFound && bestLine) {
                  // We found the first non-blank answer after the end of a question. Use it.
                  break;
                }
              }
              discoveryResponse =
                bestLine || 'Sorry I currently do not have an appropriate response for your query. Our customer care executive will call you in 24 hours.';
            }
            if (data.context.action.lookup === LOOKUP_ERROR){
              data.context.wikilink = "https://en.wikipedia.org/w/api.php?action=opensearch&search="+data.context.lang+"&limit=3&format=json";
            }else if (data.context.action.lookup === LOOKUP_THEORY){
              data.context.wikilink = "https://en.wikipedia.org/w/api.php?action=opensearch&search="+data.context.concept+"&limit=3&format=json";
            }else if (data.context.action.lookup === LOOKUP_INSTALL){
              data.context.wikilink = "https://en.wikipedia.org/w/api.php?action=opensearch&search="+data.context.lang+"&limit=3&format=json";
            }else if (data.context.action.lookup === LOOKUP_INSTALL){
              data.context.wikilink = "https://en.wikipedia.org/w/api.php?action=opensearch&search="+data.context.lang+"&limit=3&format=json";
            }
            if (data.output.text) {
              
              data.output.text.push(discoveryResponse);
              console.log('qwertyu',data.output.text);
            }
                  //External link redirect code here
             
              console.log('**x***** wikilink : '+data.context.wikilink);
            // Clear the context's action since the lookup and append was completed.
            data.context.action = {};
  
            callback(null, data);
            // Clear the context's action since the lookup was completed.
            payload.context.action = {};
          });
        }
        console.log('******* wikilink 1: '+data.context.wikilink);

      } //whthing endsen no
      

        
     
      // run your async function
      
        
      }
      
      //Lookup Error end
     else  {
      payload.context.action = {};
      data.context.action={};
      callback(null, data);
      return;
    }
    
  }
    else {
      data.context.action = {};
      callback(null, data);
      return;
    }
  } 

  app.post('/api/speech-to-text', function(req, res) {
    if (setupError) {
      return res.json({ output: { text: 'The app failed to initialize properly. Setup and restart needed.' + setupError } });
    }

    fs.writeFile('audio1.mp3', req.body, function(err) {
      // res.sendStatus(err ? 500 : 200);
      console.log('Error while writing file');
    });
    var combinedStream = CombinedStream.create();
    combinedStream.append(fs.createReadStream('audio1.mp3'));
    // combinedStream.append(fs.createReadStream('audio-file2.fl==ac'));
    var recognizeParams = {
      audio: req.body,
      content_type: 'audio/mp3'
    };
    speechToText.recognize(recognizeParams, function(error, speechRecognitionResults) {
      if (error) {
        console.log(error);
      } else {
        console.log('vaibhav k',JSON.stringify(speechRecognitionResults.transcript, null, 2));
        return res.json(speechRecognitionResults.transcript);
      }

    });
   
    /* console.log('Audio data',req.body);
    const payload = {
      audio:req.body,
      content_type:'audio/wav'
    };
    speechToText.recognize(payload, function(error,data){
      if(error){
        console.log('Speech to text conversation error');
        return res.status(error.code || 500).json(error);
      }
      else{
        console.log('Speeh to text: ', data);
        return res.json(data);
      }
    }); */

  });




/**
 * Handle setup errors by logging and appending to the global error text.
 * @param {String} reason - The error message for the setup error.
 */
function handleSetupError(reason) {
  setupError += ' ' + reason;
  console.error('The app failed to initialize properly. Setup and restart needed.' + setupError);
  // We could allow our chatbot to run. It would just report the above error.
  // Or we can add the following 2 lines to abort on a setup error allowing Bluemix to restart it.
  console.error('\nAborting due to setup error!');
  process.exit(1);
}

module.exports = app;
