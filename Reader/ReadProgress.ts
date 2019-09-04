/// <reference path="ReadProgressHead.ts" />
/// <reference path="ReadProgressCache.ts" />

module FB3BookReadProgress {

	class Catalit extends CatalitWeb.CatalitWebApp {

        private artID: string;
        private isTrial: boolean;
        private isSubscription: boolean;
        private readProgress: BookReadProgress;

        private sendReport(param: object, successCallback: (response) => void, failureCallback?: () => void): void {

            // console.log('sending report to catalit');
            // console.log(param);

            param['t'] = this.isTrial ? 1 : 0;
            param['f'] = this.isSubscription ? 1 : 0;

            this.addNewRequest({

                func: 'w_read_report',
                id: 'w_read_report',
                param: param
			});

            this.requestAPI(successCallback, failureCallback);
        }

        public SendReadReport(CharactersRead: number, Promille: number, successCallback: (response) => void, failureCallback?: () => void): void {

			this.clearRequestsArray();

            var param = {
                art: this.artID,
                h: CharactersRead,
                p: Promille
            };

            this.sendReport(param, successCallback, failureCallback);
		}

        public SendPageFlipReport(Promille: number, EventsNumber: number, successCallback: (response) => void, failureCallback?: () => void): void {

			this.clearRequestsArray();

            var param = {
                art: this.artID,
                h: 0,
                n: EventsNumber,
                p: Promille
            };

            this.sendReport(param, successCallback, failureCallback);
        }

		public setArtID(artID): string {
			return this.artID = artID;
		}

        public setTrialSign(isTrial: boolean): boolean {
            return this.isTrial = isTrial;
		}

        public setSubscriptionSign(isSubscription: boolean): boolean {
			return this.isSubscription = isSubscription;
		}

        public setCaller(readProgress: BookReadProgress): BookReadProgress {
            return this.readProgress = readProgress;
		}
	}

    class BookReadProgressInfo implements IBookReadProgressInfo {

        CharactersRead: number;
        LastReportReadPos: number;
        FlippedPagesNumber: number;
        ReadRanges: FB3DOM.IRange[];

        isChanged: boolean;

        public Dump(): string {

            var Dump = new FB3ReadProgressCache.ReadProgressDump(this);

            return Dump.toString();
        }

        public Restore(Data: string) {

            if (!Data) {
                return false;
            }

            var Dump = new FB3ReadProgressCache.ReadProgressDump(Data);

            this.CharactersRead = Dump.CharactersRead;
            this.ReadRanges = Dump.ReadRanges;
            this.LastReportReadPos = Dump.LastReportReadPos;

            return true;
        }

        constructor(private Reader: FB3Reader.Reader) {

            this.CharactersRead = 0;
            this.LastReportReadPos = 0;
            this.FlippedPagesNumber = 0;

            this.ReadRanges = [];

            this.isChanged = true;
        }

        private Inc(Pos: FB3ReaderAbstractClasses.IPosition) {
            var newPos: FB3ReaderAbstractClasses.IPosition = Pos.slice(0);
            if (Pos.length > 0) {
                Pos[Pos.length - 1] += 1;
            }
            return Pos;
        }

        private CompactReadRanges() {
            // [{From: [10], To: [12.1]}, {From: [12.2], To: [15]}] -> [{From: [10], To: [15]}]

            if (this.ReadRanges.length < 2) return;

            var newRanges: FB3DOM.IRange[] = this.ReadRanges.slice(0, 1);

            for (var i = 1; i < this.ReadRanges.length; i++) {

                var To = newRanges[newRanges.length - 1].To;
                var To2 = newRanges[newRanges.length - 1].To.slice(0); To2[To2.length - 1]++;
                var From = this.ReadRanges[i].From.toString();

                if (To.toString() == From || To2.toString() == From) {
                    newRanges[newRanges.length - 1].To = this.ReadRanges[i].To;
                    continue;
                }

                newRanges.push(this.ReadRanges[i]);
            }
            this.ReadRanges = newRanges;
        }

        private isGreater(
            RangeA: FB3ReaderAbstractClasses.IPosition,
            RangeB: FB3ReaderAbstractClasses.IPosition,
            IsLeft = false,
            IsEnclosed = false
        ): boolean {

        /*
        isLeft: [39] < [39,10]
        */

            if (IsEnclosed) {

                if (RangeA.length == 0 && RangeB.length == 0) return false; // OrEquals
                if (RangeA.length == 0 && RangeB.length > 0) return !IsLeft; // true
                if (RangeB.length == 0) return IsLeft; // false
            }

            if (RangeA[0] >  RangeB[0]) return true;

            if (RangeA[0] == RangeB[0]) {
                return this.isGreater(RangeA.slice(1), RangeB.slice(1), IsLeft, true);
            }
            return false;
        }

        private isGreaterLeft(RangeA: FB3ReaderAbstractClasses.IPosition, RangeB: FB3ReaderAbstractClasses.IPosition): boolean {
            var IsLeft = true;
            return this.isGreater(RangeA, RangeB /*, IsLeft */);
        }

        private isGreaterRight(RangeA: FB3ReaderAbstractClasses.IPosition, RangeB: FB3ReaderAbstractClasses.IPosition): boolean {
            return this.isGreater(RangeA, RangeB);
        }

        private CalculateRangeLength(
            From: FB3ReaderAbstractClasses.IPosition,
            To: FB3ReaderAbstractClasses.IPosition,
            IsEnclosed = false,
            Childs?
        ): number {
            var contentLength = 0;
            var debugText = '';

            if (!IsEnclosed) {
                if (!this.Reader.FB3DOM || !this.Reader.FB3DOM.Childs || this.Reader.FB3DOM.Childs.length == 0) {
                    // console.log('DOM is not loaded yet');
                    return 0;
                }
                return this.CalculateRangeLength(From, To, true, this.Reader.FB3DOM.Childs);
            }

            var min = (From.length > 0) ? From[0] : 0;
            var max = (To.length > 0) ? To[0] : Childs.length - 1;

            for (var i = min; i <= max; i++) {

                var NextFrom = (From.length > 1 && i > From[0]) ? [] : From.slice(1);
                var NextTo = (i == max) ? To.slice(1) : [];

                if (Childs[i].text.length == 0) {
                        // console.log('PARAGRAPH LEN ' + Childs[i].Chars);
                }
                else if (Childs[i].text && Childs[i].text.length > 0 && From.length <= 1) {

                    contentLength += Childs[i].Chars;
                    debugText += Childs[i].text;

                    /*
                    contentLength += Childs[i].text.length;
                    var hyphs = Childs[i].text.match(/\u00AD/g);
                    if (hyphs) {
                        console.log('PAGE LEN DIFF TEXT ===> ' + Childs[i].text.length + ' # ' + Childs[i].Chars + ' / ' + hyphs.length);
                        contentLength -= hyphs.length;
                    }
                    else {
                        console.log('PAGE LEN DIFF TEXT ===> ' + Childs[i].text.length + ' # ' + Childs[i].Chars);
                    }
                    */
                }

                if (Childs[i].Childs) {
                    contentLength += this.CalculateRangeLength(NextFrom, NextTo, true, Childs[i].Childs);
                }
            }
            // console.log(debugText);
            // console.log(debugText.length);
            // console.log(contentLength);
            return contentLength;
        }

        private WalkReadRange(Page: FB3ReaderPage.ReaderPage, DoUpdateRange?: boolean): number {

            var Range = {
                'From': Page.WholeRangeToRender.From.slice(0),
                'To': Page.WholeRangeToRender.To.slice(0)
            }

            var ContentLength = Page.ContentLength;

            for (var i = 0; i < this.ReadRanges.length; i++) {

                if (this.isGreaterLeft(Range.From, Range.To)) break;

                var canContinue = (i < this.ReadRanges.length - 1);

                if (this.isGreaterLeft(Range.From, this.ReadRanges[i].From)) {

                    if (this.isGreaterLeft(Range.From, this.ReadRanges[i].To)) {

                        if (canContinue) continue;
                        break; // add new element
                    }
                    if (this.isGreaterRight(Range.To, this.ReadRanges[i].To)) {

                        if (canContinue) {
                            
                            ContentLength -= this.CalculateRangeLength(Range.From, this.ReadRanges[i].To);
                            Range.From = this.Inc(this.ReadRanges[i].To);
                            continue;
                        }
                        ContentLength -= this.CalculateRangeLength(Range.From, this.ReadRanges[i].To);
                        if (DoUpdateRange) this.ReadRanges[i].To = Range.To;
                        return ContentLength;
                    }

                    // range already read
                    ContentLength -= this.CalculateRangeLength(Range.From, Range.To);
                    return ContentLength;
                    // return 0; // ContentLength? 2nd and further cycles will produce wrong value
                }
                if (this.isGreaterRight(Range.To, this.ReadRanges[i].From)) {

                    if (this.isGreaterRight(Range.To, this.ReadRanges[i].To)) {

                        if (canContinue) {

                            ContentLength -= this.CalculateRangeLength(this.ReadRanges[i].From, this.ReadRanges[i].To);
                            if (DoUpdateRange) this.ReadRanges[i].From = Range.From;
                            Range.From = this.Inc(this.ReadRanges[i].To);
                            continue;
                        }

                        ContentLength -= this.CalculateRangeLength(this.ReadRanges[i].From, this.ReadRanges[i].To);
                        if (DoUpdateRange) this.ReadRanges[i] = Range;
                        return ContentLength;
                    }
                    ContentLength -= this.CalculateRangeLength(this.ReadRanges[i].From, Range.To);
                    if (DoUpdateRange) this.ReadRanges[i].From = Range.From;
                    return ContentLength;
                }
                else {

                    if (DoUpdateRange) this.ReadRanges.splice(i, 0, Range); // insert before current element
                    return ContentLength;
                }
            }

            if (DoUpdateRange) this.ReadRanges.push(Range);
            return ContentLength;
        }

        public Contains(Page: FB3ReaderPage.ReaderPage): number {
            return this.WalkReadRange(Page);
        }

        public AddPage(Page: FB3ReaderPage.ReaderPage): number {

            // console.log('page length: ' + Page.ContentLength);

            var DoUpdateRange = true;

            var contentLength = this.WalkReadRange(Page, DoUpdateRange);

            if (contentLength > 0) {

                this.CharactersRead += contentLength;

                this.CompactReadRanges();

                this.isChanged = true;

                // console.log('page added: ' + contentLength + ' more symbols. total: ' + this.CharactersRead);
            }

            return contentLength;
        }
    }

    export class BookReadProgress implements IBookReadProgress {

        Info: IBookReadProgressInfo;
        private Reader: FB3Reader.Reader;
        private Cache: FB3ReadProgressCache.IReadProgressCache;
        private Catalit: Catalit;

        public AddPage(Page: FB3ReaderPage.ReaderPage): number {

            var Data = this.Cache.Retrieve();
            if (Data) {
                // console.log('read progress retrieved localcache');
                this.Info.Restore(Data);
            }

            // console.log(Page.WholeRangeToRender);

            if (!Page || !Page.WholeRangeToRender) {

                // console.log('DOM is not fully initialized');
                return 0;
            }

            this.SendPageFlipReport();

            // console.log(Page.WholeRangeToRender.From[0] + ' ... ' + Page.WholeRangeToRender.To[0]);

            // Page.WholeRangeToRender.From.forEach(function (e) { console.log(e) });
            // console.log(' ... ');
            // Page.WholeRangeToRender.To.forEach(function (e) { console.log(e) });

            // this.Info.ReadRanges.push(Page.WholeRangeToRender);

            // we should retrieve progress from cache every time to sync tabs data
            /*
            */

            var charactersRead = this.Info.AddPage(Page);

            if (this.Cache.Store(this.Info.Dump())) {
                // console.log('read progress stored to localcache');
            }
        }

        public FlipPage(PageNumber: number = 1): number {

            this.Info.FlippedPagesNumber += PageNumber;

            if (0 > this.Info.FlippedPagesNumber) {
                console.log('Flip page number is negative: ' + this.Info.FlippedPagesNumber + ' we should look into it')
                this.Info.FlippedPagesNumber = 0;
            }

            // console.log('-------> FlipPage() ' + this.Info.FlippedPagesNumber);

            return this.Info.FlippedPagesNumber;
        }

        public ResetFlippedPagesCounter(): void {

            // console.log('-------> ResetFlippedPagesCounter() ');

            this.Info.FlippedPagesNumber = 0;
        }

        public Contains(Page: FB3ReaderPage.ReaderPage): number {

            return this.Info.Contains(Page);
        }

        private GetPromille(): number {

            var promille = Math.floor(this.Reader.CurPosPercent() * 10);
            return promille > 0 ? promille : 1;
        }

        public SendReadReport(): void {

            if ( ! this.Info.isChanged ) {

                // console.log('nothing has changed, nothing to send.')
                return;
            }

            var charactersRead = this.Info.CharactersRead - this.Info.LastReportReadPos;

            if ( 0 >= charactersRead ) {

                console.log('NOTE: very strange, negative or zero characters read amount. report was not sent.');
                return;
            }

            // console.log('-------> SendReadReport() ');

            this.Catalit.SendReadReport(
                charactersRead,
                this.GetPromille(),
                (response) => {
                    this.Info.isChanged = false;
                    this.Info.LastReportReadPos = this.Info.CharactersRead;
                    this.Cache.Store(this.Info.Dump());
                    /* console.log(response); */
                },
                () => console.log('unable to send read report, characters read: ' + charactersRead + ' last report pos ' + this.Info.LastReportReadPos + ' total read: ' + this.Info.CharactersRead)
            );
        }

        public SendPageFlipReport(): void {

            var pagesNumber = this.Info.FlippedPagesNumber - this.Reader.GetPagesQueueLen();

            if (1 >= pagesNumber) return;

            // console.log('-------> SendPageFlipReport() ' + pagesNumber);

            this.Catalit.SendPageFlipReport(
                this.GetPromille(),
                pagesNumber,
                (response) => {
                    this.FlipPage(-pagesNumber);
                    this.Cache.Store(this.Info.Dump());
                    /* console.log(response); */
                },
                () => console.log('unable to send page flip report, pages: ' + pagesNumber)
            );
            // this.Info.FlippedPagesNumber = 0;
        }

        constructor(Reader: FB3Reader.Reader, SID: string, ArtID: string, IsTrial: boolean, IsSubscription: boolean) {

            this.Reader = Reader;
            this.Cache  = new FB3ReadProgressCache.ReadProgressCache(Reader);
            this.Info   = new BookReadProgressInfo(Reader);

            this.Catalit = new Catalit(SID, window.location.host);
            this.Catalit.setArtID(ArtID);
            this.Catalit.setTrialSign(IsTrial);
            this.Catalit.setSubscriptionSign(IsSubscription);
            this.Catalit.setCaller(this);
        }
    }
}
