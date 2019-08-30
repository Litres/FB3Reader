/// <reference path="FB3ReaderHead.ts" />

module FB3BookReadProgress {

    export interface IBookReadProgressInfo {

        CharactersRead: number;      // total number of read characters
        LastReportReadPos: number;   // last reported position
        FlippedPagesNumber: number;  // number of continuously flipped pages 
        ReadRanges: FB3DOM.IRange[]; // ranges (chunks) already read
        isChanged: boolean;

        Contains(Page: FB3ReaderPage.ReaderPage): number;
        AddPage(Page: FB3ReaderPage.ReaderPage): number;

        Dump(): string;
        Restore(Data: string): boolean;
    }

    export interface IBookReadProgress {

        Contains(Page: FB3ReaderPage.ReaderPage): number;
        AddPage(Page: FB3ReaderPage.ReaderPage): number;
        FlipPage(PageNumber?: number): number;
        ResetFlippedPagesCounter(): void;
        SendReadReport(): void;
        SendPageFlipReport(): void;
    }
}