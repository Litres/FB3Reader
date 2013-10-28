/// <reference path="../FB3ReaderHeaders.ts" />

module FB3Selection {
	interface IXpath extends String { };
	interface ISelection {
		ID: string;
		Start: IXpath;
		End: IXpath;
		Title: string;
		Description: string; // this is not really HTML neigher plain text, but p/strong/emphasis mix
		Group: number;
	}
}