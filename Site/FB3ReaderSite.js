/// <reference path="FB3ReaderSiteHead.ts" />
var FB3ReaderSite;
(function (FB3ReaderSite) {
    var ExampleSite = (function () {
        function ExampleSite(Canvas) {
            var _this = this;
            this.Canvas = Canvas;
            this.CanStoreBookmark = false;
            this.ViewText = new ViewText();
            this.Progressor = new ExampleProgressor('AlertSpan', 'MessSpan', 'ProgressSpan');
            this.IdleThreadProgressor = new ExampleProgressor('IdleAlertSpan', 'IdleMessSpan', 'IdleProgressSpan');
            this.Alert = function (Message) { return _this.Progressor.Alert(Message); };
            this.Key = 'Times:16';
        }
        ExampleSite.prototype.getElementById = function (elementId) {
            return document.getElementById(elementId);
        };
        ExampleSite.prototype.elementFromPoint = function (x, y) {
            return document.elementFromPoint(x, y);
        };
        ExampleSite.prototype.HeadersLoaded = function (MetaData) {
        };
        ExampleSite.prototype.AfterTurnPageDone = function (Data) {
            if (Data.CurPage) {
                document.getElementById('CurPosPage').innerHTML = Data.CurPage.toFixed(0) + '/' + (Data.MaxPage ? Data.MaxPage.toFixed(0) : '?');
            }
            LitresLocalBookmarks.SetCurrentPosition(Data.Pos);
        };
        ExampleSite.prototype.BookCacheDone = function (Data) {
        };
        ExampleSite.prototype.StoreBookmarksHandler = function (timer) {
        };
        ExampleSite.prototype.AfterStoreBookmarks = function () {
        };
        ExampleSite.prototype.BeforeBookmarksAction = function () {
            return true;
        };
        ExampleSite.prototype.ZoomImg = function (obj) {
            // obj
            // 	data-path="" - src for real img
            //	data-w="" - real img width
            //	data-h="" - real img height
        };
        ExampleSite.prototype.ZoomHTML = function (HTML) {
            // For zoomed down (for any reason) elements engine will call this to
            // show full-scale contents of the element
            alert(HTML);
        };
        ExampleSite.prototype.HistoryHandler = function (Pos) {
        };
        ExampleSite.prototype.showTrialEnd = function (ID) {
            return '';
        };
        ExampleSite.prototype.addTrialHandlers = function () {
        };
        ExampleSite.prototype.PrepareHTML = function (HTMLString) {
            return HTMLString;
        };
        ExampleSite.prototype.PatchNoteNode = function (Node) {
            Node.className += ' overfloatednote';
            return Node;
        };
        return ExampleSite;
    })();
    FB3ReaderSite.ExampleSite = ExampleSite;
    var ExampleProgressor = (function () {
        function ExampleProgressor(AlertSpan, MessSpan, ProgressSpan) {
            this.AlertSpan = AlertSpan;
            this.MessSpan = MessSpan;
            this.ProgressSpan = ProgressSpan;
            this.Hourglasses = {};
            this.Progresses = {};
        }
        ExampleProgressor.prototype.Alert = function (Message) {
            document.getElementById(this.AlertSpan).innerHTML = Message;
            //			window.alert(Message);
        };
        ExampleProgressor.prototype.HourglassOn = function (Owner, LockUI, Message) {
            this.Hourglasses[Owner.toString()] = 1;
            document.getElementById(this.MessSpan).innerHTML = Message;
            //			document.body.style.cursor = 'wait';
        };
        ExampleProgressor.prototype.Progress = function (Owner, Progress) {
            this.Progresses[Owner] = Progress;
            var N = 0;
            var OverallProgress = 0;
            for (var ProgressInst in this.Progresses) {
                N++;
                OverallProgress = this.Progresses[ProgressInst];
            }
            OverallProgress = OverallProgress / N;
            document.getElementById(this.ProgressSpan).innerHTML = OverallProgress.toFixed(1);
        };
        ExampleProgressor.prototype.HourglassOff = function (Owner) {
            this.Hourglasses[Owner] = 0;
            var HaveLive = 0;
            for (var Hourglass in this.Hourglasses) {
                if (this.Hourglasses[Hourglass] > 0) {
                    HaveLive = 1;
                    break;
                }
            }
            if (!HaveLive) {
                this.Hourglasses = {};
                this.Progresses = {};
            }
            else {
                this.Progress(Owner, 100);
            }
        };
        ExampleProgressor.prototype.Tick = function (Owner) {
            if (!this.Progresses[Owner]) {
                this.Progresses[Owner] = 1;
            }
            else if (this.Progresses[Owner] < 99) {
                this.Progresses[Owner] += 1;
            }
            this.Progress(Owner, this.Progresses[Owner]);
        };
        return ExampleProgressor;
    })();
    FB3ReaderSite.ExampleProgressor = ExampleProgressor;
    var ViewText = (function () {
        function ViewText() {
            this.TextArray = {
                'BOOKMARK_IMAGE_PREVIEW_TEXT': '�����������',
                'BOOKMARK_EMPTY_TYPE_1_TEXT': '��������',
                'BOOKMARK_EMPTY_TYPE_3_TEXT': '�������'
            };
        }
        ViewText.prototype.Print = function (Index) {
            return this.TextArray[Index];
        };
        return ViewText;
    })();
    FB3ReaderSite.ViewText = ViewText;
})(FB3ReaderSite || (FB3ReaderSite = {}));
//# sourceMappingURL=FB3ReaderSite.js.map