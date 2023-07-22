import {Recognizer, SpeechRecognitionEventArgs} from 'microsoft-cognitiveservices-speech-sdk';
import {AzureOptions, OnError, Options, Translations} from '../../types/options';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import {AzureSpeechConfig} from './azureSpeechConfig';
import {AzureTranscript} from './azureTranscript';
import {Speech} from '../../speech';

export class Azure extends Speech {
  private _service?: sdk.SpeechRecognizer;
  private _onError?: OnError;
  private _translations?: Translations;

  start(options: Options & AzureOptions) {
    this.prepareBeforeStart(options);
    this.instantiateService(options);
    this._onError = options?.onError;
    this._service?.startContinuousRecognitionAsync(() => {}, this.error);
    this._translations = options?.translations;
  }

  private instantiateService(options: Options & AzureOptions) {
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const speechConfig = AzureSpeechConfig.get(sdk.SpeechConfig, options);
    if (!speechConfig) return;

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    this.setEvents(recognizer);
    this._service = recognizer;
    // const speechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    // if (!speechRecognition) {
    //   console.error('Speech Recognition is unsupported');
    // } else {
    //   this._service = new speechRecognition();
    //   this._service.continuous = true;
    //   this._service.lang = options?.lang || 'en-US';
    //   this.setEvents();
    // }
  }

  private setEvents(recognizer: sdk.SpeechRecognizer) {
    recognizer.recognizing = this.onRecognizing.bind(this);
    recognizer.recognized = this.onRecognized.bind(this);
    recognizer.sessionStarted = this.onSessionStarted.bind(this);
    recognizer.canceled = this.onCanceled.bind(this);
    recognizer.sessionStopped = this.onSessionStopped.bind(this);

    // PhraseListGrammar allows for the customization of recognizer vocabulary.
    // The semicolon-delimited list of words or phrases will be treated as additional, more likely components
    // of recognition results when applied to the recognizer.
    //
    // See https://docs.microsoft.com/azure/cognitive-services/speech-service/get-started-speech-to-text#improve-recognition-accuracy
    // if (phrases.value) {
    //   const phraseListGrammar = sdk.PhraseListGrammar.fromRecognizer(recognizer);
    //   phraseListGrammar.addPhrases(phrases.value.split(';'));
    // }
  }

  // prettier-ignore
  private onRecognizing(_: Recognizer, event: SpeechRecognitionEventArgs) {
    const {interimTranscript, finalTranscript} = AzureTranscript.extract(
      event.result.text, this.finalTranscript, false, this._translations);
    this.updateElements(interimTranscript, finalTranscript);
  }

  // WORK - huge opportunity to fix this in the repo!!!!!
  //   function onRecognized(sender, recognitionEventArgs) {
  //     var result = recognitionEventArgs.result;
  //     onRecognizedResult(recognitionEventArgs.result);
  // }

  // prettier-ignore
  private onRecognized(_: Recognizer, event: SpeechRecognitionEventArgs) {
    const result = event.result;
    switch (result.reason) {
      case sdk.ResultReason.Canceled:
        break;
      case sdk.ResultReason.RecognizedSpeech:
        if (result.text) {
          const {interimTranscript, finalTranscript} = AzureTranscript.extract(
            result.text, this.finalTranscript, true, this._translations);
          this.updateElements(interimTranscript, finalTranscript);
        }
        break;
    }
  }

  private onCanceled(_: Recognizer, event: sdk.SpeechRecognitionCanceledEventArgs) {
    if (event.reason === sdk.CancellationReason.Error) {
      this.error(event.errorDetails);
    }
  }

  // WORK - include an API for when the service is loading
  private onSessionStarted() {
    this.recognizing = true;
  }

  private onSessionStopped() {
    this.recognizing = false;
  }

  stop(isDuringReset?: boolean) {
    this._service?.stopContinuousRecognitionAsync();
    this.finalise(isDuringReset);
  }

  static isSupported(): boolean {
    // WORK - check if key is valid
    return !!window.webkitSpeechRecognition || window.SpeechRecognition;
  }

  private error(details: string) {
    console.error(details);
    this._onError?.(details);
    this.recognizing = false;
  }
}