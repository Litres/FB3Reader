/// <reference path="../Reader/FB3ReaderHead.ts" />
/// <reference path="../Reader/ReadProgressHead.ts" />
/// <reference path="../Storage/StorageHead.ts" />
/// <reference path="../plugins/lz-string.d.ts" />

module FB3ReadProgressCache {

    export var LocalStorage: boolean; // global for window.localStorage check
    var SkipCache: boolean = false;   // For debug purposes

    export interface IReadProgressCache {

        Store(Data: string): boolean;
        Retrieve(): string;
    }

    export interface IReadProgressDump {

        CharactersRead:   number;
        LastReportReadPos: number;

        ReadRanges: FB3DOM.IRange[];
    }

    export class ReadProgressDump implements IReadProgressDump {

        public CharactersRead: number;
        public LastReportReadPos: number;

        public ReadRanges: FB3DOM.IRange[];

        constructor(Data: string | IReadProgressDump) {

            var DumpObject : IReadProgressDump;

            if (typeof (Data) == 'string') {

                try {
                    DumpObject = JSON.parse(Data);
                }
                catch (e) {

                    DumpObject = { CharactersRead: 0, LastReportReadPos : 0, ReadRanges: [] };
                }
            }
            else {
                DumpObject = Data;
            }

            [ 'CharactersRead', 'LastReportReadPos', 'ReadRanges' ].forEach(

                (e) => { if (DumpObject.hasOwnProperty(e)) this[e] = DumpObject[e]; }
            );
        }

        public toString(): string {

            return JSON.stringify(this);
        }
    }

    export class ReadProgressCache implements IReadProgressCache {

        private Encrypt: boolean;
        private storageAvailable: boolean;

        private Reader: FB3Reader.Reader;
        private Key: string;

        constructor(Reader: FB3Reader.Reader, Encrypt = true) {

            this.Encrypt = Encrypt;
            this.Reader = Reader;
            SkipCache = !FB3Storage.CheckStorageAvail();
        }

        private getKey(): string {

            // book is not loaded yet
            if (!this.Reader.FB3DOM.MetaData || !this.Reader.FB3DOM.MetaData.UUID) {

                SkipCache = true;
                return undefined;
            }

            if (this.Key !== undefined) {
                return this.Key;
            }

            return this.Key = ['FB3ReaderProgress', this.Reader.Version, this.Reader.FB3DOM.MetaData.UUID, this.Reader.Site.Key].join(':');
        }

        public Store(Data: string): boolean {

            if (SkipCache) {
                return false;
            }

            return this.SaveData(this.EncodeData(Data));
        }

        public Retrieve(): string {

            if (SkipCache) {

                return undefined;
            }

            return this.DecodeData(this.LoadData());
        }

        private DecodeData(Data: string): string {

            if (this.Encrypt) {
                return LZString.decompressFromUTF16(Data);
            }

            return Data;
        }

        private EncodeData(Data: string): string {

            if (this.Encrypt) {
                return LZString.compressToUTF16(Data);
            }

            return Data;
        }

        private LoadData(): string {

            if ( FB3Storage.CheckStorageAvail() ) {

                return this.DecodeData(localStorage[this.getKey()]);
            }

            return undefined;
        }

        private SaveData(Data: string): boolean {

            if (FB3Storage.CheckStorageAvail()) {

                localStorage[this.getKey()] = this.EncodeData(Data);
                return true;
            }

            return false;
        }
    }
}