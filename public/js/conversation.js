/* eslint-disable prettier/prettier */
/* eslint-disable require-jsdoc */
/* eslint-disable no-var */
/*eslint-env browser */
// The ConversationPanel module is designed to handle
// all display and behaviors of the conversation column of the app.
/* eslint no-unused-vars: "off" */
/* global Api: true, Common: true*/

var ConversationPanel = (function() {
  var settings = {
    selectors: {
      chatBox: '#scrollingChat',
      fromUser: '.from-user',
      fromWatson: '.from-watson',
      latest: '.latest'
    },
    authorTypes: {
      user: 'user',
      watson: 'watson'
    }
  };

  // Publicly accessible methods defined
  return {
    init: init,
    inputKeyDown: inputKeyDown
  };

  // Initialize the module
  function init() {
    chatUpdateSetup();
    Api.sendRequest( '', null );
    setupInputBox();
  }
  // Set up callbacks on payload setters in Api module
  // This causes the displayMessage function to be called when messages are sent / received
  function chatUpdateSetup() {
    var currentRequestPayloadSetter = Api.setRequestPayload;
    Api.setRequestPayload = function(newPayloadStr) {
      currentRequestPayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.user);
    };

    var currentResponsePayloadSetter = Api.setResponsePayload;
    Api.setResponsePayload = function(newPayloadStr) {
      currentResponsePayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.watson);
    };
  }

  function setupInputBox() {
    var input = document.getElementById('textInput');
    var dummy = document.getElementById('textInputDummy');
    var padding = 3;

    if (dummy === null) {
      var dummyJson = {
        'tagName': 'div',
        'attributes': [{
          'name': 'id',
          'value': 'textInputDummy'
        }]
      };

      dummy = Common.buildDomElement(dummyJson);
      ['font-size', 'font-style', 'font-weight', 'font-family', 'line-height', 'text-transform', 'letter-spacing'].forEach(function(index) {
        dummy.style[index] = window.getComputedStyle( input, null ).getPropertyValue( index );
      });

      document.body.appendChild(dummy);
    }

    input.addEventListener('input', function() {
      if (this.value === '') {
        this.classList.remove('underline');
        this.setAttribute('style', 'width:' + '100%');
        this.style.width = '100%';
      } else {
        this.classList.add('underline');
        var txtNode = document.createTextNode(this.value);
        dummy.textContent = txtNode.textContent;
        var widthValue = ( dummy.offsetWidth + padding) + 'px';
        this.setAttribute('style', 'width:' + widthValue);
        this.style.width = widthValue;
      }
    });

    Common.fireEvent(input, 'input');
  }

  // Display a user or Watson message that has just been sent/received
  function displayMessage(newPayload, typeValue) {
    var isUser = isUserMessage(typeValue);
    var textExists = (newPayload.input && newPayload.input.text) ||
        (newPayload.output && newPayload.output.text);
    if (isUser !== null && textExists) {
      // Create new message DOM element
      var messageDivs = buildMessageDomElements(newPayload, isUser);
      var chatBoxElement = document.querySelector(settings.selectors.chatBox);
      var previousLatest = chatBoxElement.querySelectorAll((isUser ?
          settings.selectors.fromUser : settings.selectors.fromWatson) +
          settings.selectors.latest);
      // Previous "latest" message is no longer the most recent
      if (previousLatest) {
        Common.listForEach(previousLatest, function(element) {
          element.classList.remove('latest');
        });
      }

      messageDivs.forEach(function(currentDiv) {
        chatBoxElement.appendChild(currentDiv);
        // Class to start fade in animation
        currentDiv.classList.add('load');
      });
      // Move chat to the most recent messages when new messages are added
      scrollToChatBottom();
    }
  }

  // Checks if the given typeValue matches with the user "name", the Watson "name", or neither
  // Returns true if user, false if Watson, and null if neither
  // Used to keep track of whether a message was from the user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === settings.authorTypes.user) {
      return true;
    } else if (typeValue === settings.authorTypes.watson) {
      return false;
    }
    return null;
  }

  // Constructs new DOM element from a message payload
  function buildMessageDomElements(newPayload, isUser) {
    var textArray = isUser ? newPayload.input.text : newPayload.output.text;
    if (Object.prototype.toString.call( textArray ) !== '[object Array]') {
      textArray = [textArray];
    }
    var messageArray = [];

    textArray.forEach(function(currentText) {
      if (currentText) {
        var messageJson = {
          // <div class='segments'>
          'tagName': 'div',
          'classNames': ['segments'],
          'children': [{
            // <div class='from-user/from-watson latest'>
            'tagName': 'div',
            'classNames': [(isUser ? 'from-user' : 'from-watson'), 'latest', ((messageArray.length === 0) ? 'top' : 'sub')],
            'children': [{
              // <div class='message-inner'>
              'tagName': 'div',
              'classNames': ['message-inner'],
              'children': [{
                // <p>{messageText}</p>
                'tagName': 'p',
                'text': currentText
              }]
            }]
          }]
        };
        messageArray.push(Common.buildDomElement(messageJson));
      }
    });

    return messageArray;
  }

  // Scroll to the bottom of the chat window (to the most recent messages)
  // Note: this method will bring the most recent user message into view,
  //   even if the most recent message is from Watson.
  //   This is done so that the "context" of the conversation is maintained in the view,
  //   even if the Watson message is long.
  function scrollToChatBottom() {
    var scrollingChat = document.querySelector('#scrollingChat');

    // Scroll to the latest message sent by the user
    var scrollEl = scrollingChat.querySelector(settings.selectors.fromUser + settings.selectors.latest);
    if (scrollEl) {
      scrollingChat.scrollTop = scrollEl.offsetTop;
    }
  }

  // Handles the submission of input
  function inputKeyDown(event, inputBox) {
    // Submit on enter key, dis-allowing blank messages
    if (event.keyCode === 13 && inputBox.value) {
      // Retrieve the context from the previous server response
      var context;
      var latestResponse = Api.getResponsePayload();
      if (latestResponse) {
        context = latestResponse.context;
      }

      // Send the user message
      Api.sendRequest(inputBox.value, context);

      // Clear input box for further messages
      inputBox.value = '';
      Common.fireEvent(inputBox, 'input');
    }
  }




}());


var settings = {
  selectors: {
    chatBox: '#scrollingChat',
    fromUser: '.from-user',
    fromWatson: '.from-watson',
    latest: '.latest'
  },
  authorTypes: {
    user: 'user',
    watson: 'watson'
  }
};

 // Checks if the given typeValue matches with the user "name", the Watson "name", or neither
  // Returns true if user, false if Watson, and null if neither
  // Used to keep track of whether a message was from the user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === settings.authorTypes.user) {
      return true;
    } else if (typeValue === settings.authorTypes.watson) {
      return false;
    }
    return null;
  }
// Display a user or Watson message that has just been sent/received
function displayMessage(newPayload, typeValue) {
  var isUser = isUserMessage(typeValue);
  var textExists = (newPayload.input && newPayload.input.text) ||
      (newPayload.output && newPayload.output.text);
  if (isUser !== null && textExists) {
    // Create new message DOM element
    var messageDivs = buildMessageDomElements(newPayload, isUser);
    var chatBoxElement = document.querySelector(settings.selectors.chatBox);
    var previousLatest = chatBoxElement.querySelectorAll((isUser ?
        settings.selectors.fromUser : settings.selectors.fromWatson) +
        settings.selectors.latest);
    // Previous "latest" message is no longer the most recent
    if (previousLatest) {
      Common.listForEach(previousLatest, function(element) {
        element.classList.remove('latest');
      });
    }

    messageDivs.forEach(function(currentDiv) {
      chatBoxElement.appendChild(currentDiv);
      // Class to start fade in animation
      currentDiv.classList.add('load');
    });
    // Move chat to the most recent messages when new messages are added
    scrollToChatBottom();
  }
}
// Constructs new DOM element from a message payload
function buildMessageDomElements(newPayload, isUser) {
  var textArray = isUser ? newPayload.input.text : newPayload.output.text;
  if (Object.prototype.toString.call( textArray ) !== '[object Array]') {
    textArray = [textArray];
  }
  var messageArray = [];

  textArray.forEach(function(currentText) {
    if (currentText) {
      var messageJson = {
        // <div class='segments'>
        'tagName': 'div',
        'classNames': ['segments'],
        'children': [{
          // <div class='from-user/from-watson latest'>
          'tagName': 'div',
          'classNames': [(isUser ? 'from-user' : 'from-watson'), 'latest', ((messageArray.length === 0) ? 'top' : 'sub')],
          'children': [{
            // <div class='message-inner'>
            'tagName': 'div',
            'classNames': ['message-inner'],
            'children': [{
              // <p>{messageText}</p>
              'tagName': 'p',
              'text': currentText
            }]
          }]
        }]
      };
      messageArray.push(Common.buildDomElement(messageJson));
    }
  });

  return messageArray;
}

// Scroll to the bottom of the chat window (to the most recent messages)
// Note: this method will bring the most recent user message into view,
//   even if the most recent message is from Watson.
//   This is done so that the "context" of the conversation is maintained in the view,
//   even if the Watson message is long.
function scrollToChatBottom() {
  var scrollingChat = document.querySelector('#scrollingChat');

  // Scroll to the latest message sent by the user
  var scrollEl = scrollingChat.querySelector(settings.selectors.fromUser + settings.selectors.latest);
  if (scrollEl) {
    scrollingChat.scrollTop = scrollEl.offsetTop;
  }
}
const recordAudio = () =>
  new Promise(async resolve => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", event => {
      audioChunks.push(event.data);
    });

    const start = () => mediaRecorder.start();

    const stop = () =>
      new Promise(resolve => {
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks);
          const audioUrl = URL.createObjectURL(audioBlob);
          createDownloadLink(audioBlob);
          const audio = new Audio(audioUrl);
          const play = () => audio.play();
          resolve({ audioBlob, audioUrl, play });
        });

        mediaRecorder.stop();
      });

    resolve({ start, stop });
  });

const sleep = time => new Promise(resolve => setTimeout(resolve, time));

const handleAction = async () => {
  const recorder = await recordAudio();
  const actionButton = document.getElementById('action');
  actionButton.disabled = true;
  recorder.start();
  await sleep(3000);
  const audio = await recorder.stop();
  audio.play();
  await sleep(3000);
  actionButton.disabled = false;
}
function createDownloadLink(blob) {
  blob = blob.slice(0, blob.size, "audio/mp3")
  console.log(blob);
  const url = '/api/speech-to-text';
  const request = new XMLHttpRequest();
  request.open('POST', url, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

  // Decode asynchronously
  request.onload = function() {
    displayMessage(request.response, 'watson');
    callConversation(request.response);
  };
  request.send(blob);
}
let conversationContext='';
function callConversation(res) {
  // $('#q').attr('disabled', 'disabled');
  Api.sendRequest(res, conversationContext);
 /*  inputBox.value = '';
    Common.fireEvent(inputBox, 'input'); */
 /*  $.post('/api/message', {
    convText: res,
    context: JSON.stringify(conversationContext)
  })
    .done(function(res, status) {
      conversationContext = res.results.context;
      play(res.results.responseText);
      displayMessage(res.results.responseText, 'watson');
    })
    .fail(function(jqXHR, e) {
      console.log('Error: ' + jqXHR.responseText);
    }); */
}