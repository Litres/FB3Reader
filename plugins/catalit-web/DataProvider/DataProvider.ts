/**
 * Отвечает за передачу данный через XMLHttpRequest
 */

export module DataProvider {
	interface DataResponse {
		ok: boolean;
		status: number;
		statusText: string;
		data: string;
		JSON: any;
		headers: string;
	}

	interface IDataProvider {
		method: string;
		url: string;
		stringifiedData: any;

		parseResult(xhr: XMLHttpRequest): DataResponse;

		HTTPRequest(successCallback: (xhrResult) => void, failureCallback?: () => void): void;
	}

	export class DataProvider implements IDataProvider {
		public method: string;
		public url: string;
		public stringifiedData: string;

		// сразу же в конструктуре задаём метод, URL и данные в формате JSON
		constructor(method: string, url: string, data: Object) {
			this.method = method;
			this.url = url;
			this.stringifiedData = JSON.stringify(data);
		}

		parseResult(xhr: XMLHttpRequest): DataResponse {
			return {
				ok: xhr.status >= 200 && xhr.status < 300,
				status: xhr.status,
				statusText: xhr.statusText,
				headers: xhr.getAllResponseHeaders(),
				data: xhr.responseText,
				JSON: JSON.parse(xhr.responseText)
			};
		}

		HTTPRequest(successCallback: (xhrResult) => void, failureCallback?: () => void): void {
			if (failureCallback == null) {
				failureCallback = function () {};
			}

			const xhr = new XMLHttpRequest();
			xhr.open(this.method, this.url);
			let data = new FormData();
			data.append("jdata", this.stringifiedData);
			xhr.send(data);

			xhr.onload = evt => {
				if (xhr.status == 200) {
					successCallback(this.parseResult(xhr));
				} else {
					failureCallback();
				}
			};

			xhr.onerror = evt => {
				failureCallback();
			};

			xhr.ontimeout = evt => {
				failureCallback();
			};
		}
	}
}