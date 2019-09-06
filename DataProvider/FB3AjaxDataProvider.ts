/// <reference path="FB3DataProviderHead.ts" />

module FB3DataProvider {

	interface IJSonLoadedCallbackWrap {
		(ID: number, URL: string, Data: any, CustomData?: any): void;
	}
	interface IJSonFailureCallbackWrap {
		(ID: number, URL: string, Error?: any): void;
	}
	interface iWindow {
		XDomainRequest?: any;
		atob: any;
		XMLHttpRequest: any;
		ActiveXObject: any;
		JSON: JSON;
	}
	declare var window: iWindow;

	export function zeroPad(num, places): string {
		var zero = places - num.toString().length + 1;
		return Array(+(zero > 0 && zero)).join("0") + num;
	}
	export class AJAXDataProvider implements IJsonLoaderFactory {
		private ActiveRequests: any;
		private CurrentRequestID: number;
		private BaseURL: string;
		public json_redirected:boolean;
		constructor(public LitresURL: string, public ArtID2URL: IArtID2URL, private TextCacheManager?: FB3TextCache.TextCacheManager) {
			this.BaseURL = LitresURL;
			this.CurrentRequestID = 0;
			this.ActiveRequests = {};
		}
		public Request(URL: string, Callback: IJSonLoadedCallback, Progressor: FB3ReaderSite.ILoadProgress, CustomData?: any, IgnoreCache: boolean = false) {
			if (this.TextCacheManager && !IgnoreCache) {
				this.TextCacheManager.Use(() => {
					this.TextCacheManager.LoadChunkData(FB3TextCache.TextCacheManager.GetStorageKey(this.BaseURL), URL, (data, customData) => {
						if (data) {
							Callback(data, customData);
						} else {
							this.InitRequest(URL, Callback, Progressor, CustomData);
						}
					});
				}, () => {
					this.InitRequest(URL, Callback, Progressor, CustomData);
				});
				return;
			}

			if (IgnoreCache === true) {
				URL = FB3TextCache.TextCacheManager.NoCacheURL(URL);
			}

			this.InitRequest(URL, Callback, Progressor, CustomData);
		}
		private InitRequest(URL: string, Callback: IJSonLoadedCallback, Progressor: FB3ReaderSite.ILoadProgress, CustomData?: any) {
			this.CurrentRequestID++;
			this.ActiveRequests['req' + this.CurrentRequestID] = Callback;
			new AjaxLoader(URL, (ID, URL, Data: any, CustomData?: any) => this.CallbackWrap(ID, URL, Data, CustomData), (ID, URL) => this.FailureCallbackWrap(ID, URL, Callback), Progressor, this.CurrentRequestID, CustomData,this.json_redirected);
		}
		private CallbackWrap(ID:number, URL:string, Data: any, CustomData?: any): void {
			if (this.TextCacheManager) {
				this.TextCacheManager.Use(()=> {
					this.TextCacheManager.SaveChunkData(FB3TextCache.TextCacheManager.GetStorageKey(this.BaseURL), URL, Data, CustomData, () => {
						this.ProcessCallback(Data, CustomData);
					});
				}, () => {
					this.ProcessCallback(Data, CustomData);
				});
				return;
			}

			this.ProcessCallback(Data, CustomData);
		}

		private ProcessCallback(Data, CustomData) {
			var Func = this.ActiveRequests['req' + this.CurrentRequestID];
			if (Func) {
				this.ActiveRequests['req' + this.CurrentRequestID](Data, CustomData);
			}
		}

		private FailureCallbackWrap(ID:number, URL:string, Callback:IJSonLoadedCallback) {
			// if we failed to download file, we anyway try to fetch it from our cache (even if had IgnoreCache option)
			if (this.TextCacheManager) {
				this.TextCacheManager.Use(() => {
					this.TextCacheManager.LoadChunkData(FB3TextCache.TextCacheManager.GetStorageKey(this.BaseURL), URL, (data, customData) => {
						if (data) {
							Callback(data, customData);
						}
					});
				});
			}
		}
		public Reset(): void {
			this.ActiveRequests = {};
		}
	}

	class AjaxLoader {
		private Req: XMLHttpRequest;
		private xhrIE9: boolean;
		constructor(public URL: string,
			private Callback: IJSonLoadedCallbackWrap,
			private FailureCallback: IJSonFailureCallbackWrap,
			private Progressor: FB3ReaderSite.ILoadProgress,
			private ID: number,
			public CustomData?: any,
			private json_redirected?: boolean
			) {
				this.xhrIE9 = false;
				this.Progressor.HourglassOn(this, false, 'Loading ' + this.URL);
				this.Req = this.HttpRequest();
				try { // Old IE with it's internals does not support this
					this.Req.addEventListener("progress", (e: ProgressEvent) => this.onUpdateProgress(e), false);
					this.Req.addEventListener("error", (e: ProgressEvent) => this.onTransferFailed(e), false);
					this.Req.addEventListener("abort", (e: ProgressEvent) => this.onTransferAborted(e), false);
				} catch (e) {
					this.Req.onprogress = function () {};
					this.Req.onerror = (e: any) => this.onTransferFailed(e);
					this.Req.ontimeout = (e: ProgressEvent) => this.onTransferAborted(e);
				}
				this.Req.open('GET', this.URL, true);
				if (this.xhrIE9) {
					this.Req.timeout = 0;
					this.Req.onload = () => this.onTransferIE9Complete();
					setTimeout(() => this.Req.send(null), 200);
				} else {
					this.Req.onreadystatechange = () => this.onTransferComplete();
					this.Req.send(null);
				}
		}

		public onTransferComplete() {
//			try {
				if (this.Req.readyState != 4) {
					this.Progressor.Tick(this);
				} else {
					this.Progressor.HourglassOff(this);
					if (this.Req.status == 200) {
						this.ParseData(this.Req.responseText);
					} else {
						this.FailureCallback(this.ID, this.URL);
						this.Progressor.Alert('Failed to load "' + this.URL + '", server returned error "' + this.Req.status + '"');
					}
				}
			//} catch (err) {
			//	this.Progressor.HourglassOff(this);
			//	this.Progressor.Alert('Failed to load "' + this.URL + '" (unknown error "' + err.description+'")');
			//}
		}

		private onTransferIE9Complete() {
			if (this.Req.responseText && this.Req.responseText != '') {
				this.ParseData(this.Req.responseText);
			} else {
				this.Progressor.Alert('Failed to load "' + this.URL + '", server returned error "NO STATUS FOR IE9"');
			}
		}

		private ParseData(Result) {
			var Data = this.parseJSON(Result);
			var URL = this.FindRedirectInJSON(Data);
			if (URL) {
				new AjaxLoader(URL,
					(ID, _, Data: any, CustomData?: any) => this.Callback(ID, this.URL, Data, CustomData),
					this.FailureCallback,
					this.Progressor,
					this.ID,
					this.CustomData);
			} else {
				this.Callback(this.ID, this.URL, Data, this.CustomData);
			}
		}

		private onUpdateProgress(e: ProgressEvent) {
			this.Progressor.Progress(this, e.loaded / e.total * 100);
		}
		private onTransferFailed(e: ProgressEvent) {
			this.Progressor.HourglassOff(this);
			this.Progressor.Alert('Failed to load "' + this.URL + '"');
			this.FailureCallback(this.ID, this.URL, e);
		}
		private onTransferAborted(e: ProgressEvent) {
			this.Progressor.HourglassOff(this);
			this.Progressor.Alert('Failed to load "' + this.URL + '" (interrupted)');
			this.FailureCallback(this.ID, this.URL, e);
		}

		private HttpRequest(): XMLHttpRequest {
			var ref = null;
			if (document.all && !window.atob && (<any> window).XDomainRequest && this.json_redirected) {
				ref = new window.XDomainRequest(); // IE9 =< fix
				this.xhrIE9 = true;
			} else if (window.XMLHttpRequest) {
				ref = new XMLHttpRequest();
			} else if (window.ActiveXObject) { // Older IE.
				ref = new ActiveXObject("MSXML2.XMLHTTP.3.0");
			}
			return ref;
		}
		private FindRedirectInJSON(data): string {
			if (data && data.url) {
				return data.url;
			}
			return undefined;
		}
		private parseJSON(data: string): Object {
			data = data.replace(/^\n/, ''); // aldebaran json workaround
			// Borrowed bits from JQuery & http://json.org/json2.js
			if (data === undefined || data =='') { return null; }

			// trim for IE
			//data = data.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

			// Attempt to parse using the native JSON parser first
			//if (window.JSON && window.JSON.parse) {
			//	return window.JSON.parse(data);
			//}

			// Make sure the incoming data is actual JSON
			//if (/^[\],:{}\s]*$/.test(data.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
			//	.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
			//	.replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) {
			//	return (new Function("return " + data))();
			//}
			//this.Progressor.Alert("Invalid JSON");

			// all shis safe and pretty stuff is nice, but I stick to simple
			var Data = (new Function("return " + data))()
			return Data;
		}
	}
}

/**
 * More common ajax loader, capable of any type of data
 */
module AjaxDataProvider {
	/**
	 * Plain loader class to process data
	 */
	export class AjaxLoader {
		private URL: string;
		private Method: string = "GET";
		private Data: any;
		private ResponseType: string;
		private SuccessCallback: (response: any) => void;
		private FailureCallback: () => void;

		constructor(Config: FB3DataProvider.RequestConfiguration) {
			if (Config.Method) {
				this.Method = Config.Method;
			}
			if (Config.Data) {
				this.Data = Config.Data;
			}

			this.URL = Config.URL;
			this.ResponseType = Config.ResponseType;
			this.SuccessCallback = Config.SuccessCallback;
			this.FailureCallback = Config.FailureCallback;
		}

		public PerformRequest() {
			const xhr = new XMLHttpRequest();
			xhr.responseType = <XMLHttpRequestResponseType>this.ResponseType;
			xhr.open(this.Method, this.URL);

			if (!this.Data) {
				xhr.send();
			} else {
				xhr.send(this.Data);
			}

			xhr.onload = evt => {
				if (xhr.status == 200) {
					this.SuccessCallback(xhr.response);
				} else {
					this.FailureCallback();
				}
			};

			xhr.onerror = evt => {
				this.FailureCallback();
			};

			xhr.ontimeout = evt => {
				this.FailureCallback();
			};
		}
	}
}