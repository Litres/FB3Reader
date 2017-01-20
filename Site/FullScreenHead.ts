/// <reference path="../../view/ts/viewHeaders.ts" />

module FullScreenSupport {
	export interface IFullScreenClass {
		fullScreen: boolean;
		fullScreenCallback(): void
		ButtonHandler(): void;
		showHiddenElements(): void;
	}
}