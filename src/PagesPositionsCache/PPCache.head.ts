import {IPageRenderInstruction} from "../Reader/FB3Reader.head";
import {IXPath} from "../DOM/FB3DOM.head";

export var MaxCacheRecords: number;
export var LocalStorage: boolean;

export interface IPageRenderInstructionsCacheEntry {
	Time: Date;
	Key: string;
	LastPage: number;
	Cache: IPageRenderInstruction[];
	MarginsCache: any; // we are going to store a plain hash here for all "margined" elements
}

export interface IFB3PPCache {
	Encrypt: boolean;
	IsReady: boolean;
	Set(I: number, Instr: IPageRenderInstruction): void;
	Get(I: number): IPageRenderInstruction;
	Save(Key: string): void;
	Load(Key: string): void;
	SetMargin(XP: string, Margin: number): void;
	GetMargin(XP: string): number;
	Reset(): void;
	Length(): number;
	LastPage(LastPageN?: number): number;
	CheckIfKnown(From: IXPath): number;
	LoadData(Callback?: Function): void;
	LoadDataAsync(ArtID: string);
	SaveData(Key: String, Data: IPageRenderInstructionsCacheEntry[], Callback?: Function): void;
}