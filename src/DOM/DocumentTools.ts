import {IFBReader} from "../Reader/FB3Reader.head";

//метод для поиска элемента по координатам, если указана глубина, то возвращает количество элементов указанное в этом параметре, если нет, то возвращает все
export function getListElementFromPoint(AFB3Reader: IFBReader, x:number,y:number,depth?:number):Array<HTMLElement> {
	var ele = document.elementFromPoint(x,y);
	if(ele.id.indexOf("wrapper") > -1 || ele.nodeName.toLowerCase() == "area" || ele.id.indexOf("empty") > -1) {
		if(document.all && !window.atob) {
			var filter = Array.prototype.filter,
				result = AFB3Reader.Site.Canvas.querySelectorAll('span, div, a, p, img'),
				elements = <any>[];
			if(!depth || depth > 1) {
				elements = filter.call( result, function( node ) {
					var pos = node.getBoundingClientRect();
					if(x > pos.left && x < pos.right && y > pos.top && y < pos.bottom) {
						return node
					}
					return null
				});


			} else {
				var sieve = Array.prototype.some;
				sieve.call(AFB3Reader.Site.Canvas.querySelectorAll('span, img'), function( node ) {
					var pos = node.getBoundingClientRect();
					if (x > pos.left && x < pos.right && y > pos.top && y < pos.bottom) {
						elements.push(node);
						return true;
					}
					return false;
				});
			}

			elements.reverse()

			return elements;
		}

		var elements = <any>[], previousPointerEvents = [], current, i, d;
		// get all elements via elementFromPoint, and remove them from hit-testing in order
		while ((current = document.elementFromPoint(x,y)) && elements.indexOf(current)===-1 && current != null) {

			// push the element and its current style
			elements.push(current);
			previousPointerEvents.push({
				value: current.style.getPropertyValue('pointer-events'),
				priority: current.style.getPropertyPriority('pointer-events')
			});

			// add "pointer-events: none", to get to the underlying element
			current.style.setProperty('pointer-events', 'none', 'important');
			if(depth && depth > 0 && elements.length > (depth + 1)) {
				break;
			}



		}

		// restore the previous pointer-events values
		for(i = previousPointerEvents.length; d=previousPointerEvents[--i]; ) {
			elements[i].style.setProperty('pointer-events', d.value?d.value:'', d.priority);
		}

		// return our results
		if(elements.length == 0) {
			return null;
		}
		elements.shift();
		elements.shift();
		return elements;

	}
}

export var doc;
if (typeof document !== "undefined") {
	doc = document
}
