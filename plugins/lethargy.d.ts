// Type definitions for Lethargy.js

interface ILethargy {
	check(): any;
}

interface ILethargyConstructable {
	new(): ILethargy;
}

declare var Lethargy: ILethargyConstructable;

declare module 'lethargy' {
	export = Lethargy;
}