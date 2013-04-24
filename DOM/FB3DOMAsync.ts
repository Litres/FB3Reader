/// <reference path="FB3DOM.ts" />

module FB3DOM {
	declare var window;
	export class FB3DOMAsync extends FB3DOMBase {

		public _Init() {
			this.RawData = new Array();
			this.Ready = false;

		}

		private parseJSON(data: string): Object {
			// Borrowed bits from JQuery & http://json.org/json2.js
			if (!data) { return null; }

			// trim for IE
			data = data.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

			// Attempt to parse using the native JSON parser first
			if (window.JSON && window.JSON.parse) {
				return window.JSON.parse(data);
			}

			// Make sure the incoming data is actual JSON
			if (/^[\],:{}\s]*$/.test(data.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
				.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
				.replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) {
				return (new Function("return " + data))();
			}
			if (this.Alert) {
				this.Alert("Invalid JSON");
			}
		}

		private XMLHttpRequest(): XMLHttpRequest {
			var Ret:any = XMLHttpRequest;
			if (typeof Ret === "undefined") {
				Ret = function () {
					try { return new ActiveXObject("Msxml2.XMLHTTP.6.0"); }
					catch (e) { }
					try { return new ActiveXObject("Msxml2.XMLHTTP.3.0"); }
					catch (e) { }
					try { return new ActiveXObject("Microsoft.XMLHTTP"); }
					catch (e) { }
					// Microsoft.XMLHTTP points to Msxml2.XMLHTTP and is redundant
					throw new Error("This browser does not support XMLHttpRequest.");
				};
			}
			return <XMLHttpRequest> Ret;
		}
	}
}