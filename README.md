# FB3Reader engine

Open source ([LGPL](http://en.wikipedia.org/wiki/GNU_Lesser_General_Public_License)) JavaScript-based eBook reader engine written in [TypeScript](http://www.typescriptlang.org/).

## How to install and run

Run `npm install` to install components ([Node.js](https://nodejs.org/) with npm is required). You can build the project by running `npm run build` (we use webpack for bundling), the resulted minified JavaScript file containing FB3Reader engine will be placed at `dist` directory along with it's TypeScript definitions (`.d.ts`)
 files.
 
## Tests

We use [Jest framework](https://jestjs.io/) to perform tests. For now we have several E2E tests that ensure correctness of rendering through image snapshots. Tests can be invoked by `npm run test`. Note that visual regression snapshots were made on MacOS. It means that you probably will have failed tests if run them on different OS due to difference in font rendering.

## Example App

There is a simple web application build with FB3Reader engine. App sources are located in `example-app` directory.

## Information about project

### Why JavaScript, it is slow!

The overall idea is to create a simplest possible wrapper for the system-native web-browser. In the
hope of browser perfectioning, we delegate to the browser 90% or more of the critical work and hope that overall
performance of the engine will be nice even if JS will not perform perfectly.

### Why TypeScript, it is new!

The reason is simple: nobody wants to maintain 300 KB of pure hardcore JS code. I (GribUser) have twice created a web-based
reader for fb2 (as you can see on [LitRes](http://www.litres.ru/)) and it got harder and harder and harder
to maintain the code. When I started to draw a class structure for the new reader I got sick of all this (function)()) stuff. Never again.
[TypeScript](https://typescriptlang.org/) is nice and simple, and it allows you to painlessly maintain
even a huge and feature-rich code.


### Who can contribute

Anyone. At the moment, I'm building a frame for the project and plan to rule the trunk for some time by myself. But you can
send me your diff or make a pull request right now, if you feel urgent. It's always fun when somebody
makes your job for you :)


### Contacts
* gu@litres.ru - Dmitry Gribov, project owner
* denis@litres.ru - Denis Kovalkov. Just in case
* samik3k@gmail.com - Alexander Sokolov. Just a coder
