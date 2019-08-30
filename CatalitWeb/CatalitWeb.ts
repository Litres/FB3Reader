/// <reference path="DataProvider.ts" />
/// <reference path="../plugins/sha256.d.ts" />

/**
 * Обеспечивает передчу данных между web и Catalitv2
 *
 * Принцип работы:
 * 1) В конструкторе указываем текщий SID пользователя, а также тестовый режим, если нужно
 * 2) Закидываем методы, которые мы хотим вызвать через метод addNewRequest(...)
 * 3) Вызываем метод requestAPI() и получаем результаты всех запрошенных методов
 */

module CatalitWeb {
	export interface IRequestObject<T> {
		func: string;
		id: string;
		param: any;
	}

	interface IServerObject {
		mobile_app?: string;
		sha?: string;
		time: string;
		sid: string;
		requests: IRequestObject<any>[];
	}

	interface IServerResponse {
		success: boolean;
		time: string;
	}

	export interface IServerResponseObject {
		success: boolean;
	}

	export class CatalitWebApp {
		private readonly secretKey = ''; 	// should be Catalit Secret Key
		private readonly appID = '';		// should be Catalit App Id Number
		private CatalitApiUrl: string;
		private SID;
		private requestsArray: IRequestObject<any>[] = [];

		private generateSha256(): string {
			let result = CatalitWebApp.getCurrentTime() + this.secretKey;
			return sha256(result);
		};

		static getCurrentTime(): string {
			let currentDate = new Date();
			let timezoneOffset = -currentDate.getTimezoneOffset(),
				dif = timezoneOffset >= 0 ? '+' : '-',
				pad = function (num) {
					let norm = Math.floor(Math.abs(num));
					return (norm < 10 ? '0' : '') + norm;
				};
			return currentDate.getFullYear() +
				'-' + pad(currentDate.getMonth() + 1) +
				'-' + pad(currentDate.getDate()) +
				'T' + pad(currentDate.getHours()) +
				':' + pad(currentDate.getMinutes()) +
				':' + pad(currentDate.getSeconds()) +
				dif + pad(timezoneOffset / 60) +
				':' + pad(timezoneOffset % 60);
		};

		static getTimestampFromString(time): number {
			return Date.parse(time) / 1000;
		}

		protected requestAPI(successCallback: (response) => void, failureCallback?: () => void): void {
			if (failureCallback == null) {
				failureCallback = function () {};
			}

			if (this.requestsArray.length == 0) {
				failureCallback();
				return;
			}

			let processApiRequest = (val, arr) => {
				let response = {};
				for (let obj of arr.requestsArray) {
					if (val[obj.id]) {
						response[obj.id] = val[obj.id];
						response['success'] = val[obj.id].success;
					}
				}

				this.clearRequestsArray();
				successCallback(response);
			}


			let serverObject: IServerObject = {
				time: '',
				sid: '',
				requests: []
			};

			serverObject.mobile_app = this.appID;
			serverObject.sha = this.generateSha256();

			serverObject.time = CatalitWebApp.getCurrentTime();
			serverObject.sid = this.SID;
			serverObject.requests = this.requestsArray;

			let newHTTPRequest = new DataProvider.DataProvider('post', this.CatalitApiUrl, serverObject);

			let self = this;
			newHTTPRequest.HTTPRequest(function(xhrResult) {
				processApiRequest(JSON.parse(xhrResult.data), self);
			}, failureCallback);
		}

		protected addNewRequest(newRequestObject: IRequestObject<any>) {
			this.requestsArray.push(newRequestObject);
		}

		public clearRequestsArray() {
			this.requestsArray = [];
		}

		private static createCatalitApiUrl(websiteDomain: string): string {
			return window.location.protocol + '//' + websiteDomain + "/catalitv2";
		}

		constructor(SID: string, websiteDomain: string) {
			this.SID = SID;
			this.CatalitApiUrl = CatalitWebApp.createCatalitApiUrl(websiteDomain);
		}
	}
}

