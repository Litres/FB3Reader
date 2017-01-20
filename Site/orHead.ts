/// <reference path="../FB3ReaderHeaders.ts" />

// TODO: fix this file

declare var addBookmark: HTMLElement;

declare var AFB3Reader: FB3Reader.IFBReader;
declare var AFB3PPCache: FB3PPCache.IFB3PPCache;
declare var BookmarksProcessor: FB3Bookmarks.IBookmarks;

declare var start: number;

declare var LitresBookmarksWindow: Bookmarks.IBookmarksWindow;

declare var FacebookSharing: SocialSharing.ISocialSharingClass;
declare var TwitterSharing: SocialSharing.ISocialSharingClass;
declare var VkontakteSharing: SocialSharing.ISocialSharingClass;

interface IImage2Center {
	img: HTMLElement;
	w?: number;
	h?: number;
}