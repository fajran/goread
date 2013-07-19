(function() {

function isArray(value) {
	return Object.prototype.toString.call(value) === '[object Array]';
}

var app = angular.module('goReadMobileApp', ['ngSanitize']);

app.filter('encodeURI', function() {
	return encodeURIComponent;
});

app.config(function($locationProvider) {
	return $locationProvider.html5Mode(true);
});

app.filter('encodeURI', function() {
	return encodeURIComponent;
});

app.directive('eatClick', function() {
	return function(scope, element, attrs) {
		$(element).click(function(event) {
			event.stopPropagation();
		});
	}
})

app.controller('MainController', function($scope, $http) {
	$scope.loading = 1;
	$scope.title = ''
	$scope.activeFeed = undefined;

	$scope.setLoaded = function() {
		$scope.loading = 0;
	}

	$scope.http = function(method, url, data) {
		return $http({
			method: method,
			url: url,
			data: $.param(data || ''),
			headers: {'Content-Type': 'application/x-www-form-urlencoded'}
		});
	};

	function collectUrls() {
		$scope.url = {
			feeds: $('body').data('url-feeds'),
			contents: $('body').data('url-contents'),
			markRead: $('body').data('url-mark-read'),
			markUnread: $('body').data('url-mark-unread'),
		}
	}

	$scope.init = function() {
		collectUrls();
		$scope.loadFeeds();
	}

	$scope.loadFeeds = function() {
		$scope.refresh(function() {
			$scope.setLoaded();
			$scope.setMode('feed');
		});
	}

	$scope.refresh = function(cb) {
		cb = cb || function() {};

		$scope.loading++;
		$http.get($scope.url.feeds)
			.success(function(data) {
				$scope.opml = data.Opml;
				$scope.stories = data.Stories;

				$scope.loading--;
				cb();
			})
			.error(function(data, status) {
				$scope.loading--;
				// TODO
			});
	}

	$scope.resetScroll = function() {
		$('.nav.top')[0].scrollIntoView(true);
	}

	// mode
	$scope.setMode = function(mode) {
		if (mode != 'story') {
			$scope.setActiveFeed(undefined);
		}
		$scope.mode = mode;
	}

	// title
	$scope.setTitle = function(title) {
		$scope.title = title;
	}

	// back button
	$scope.backButton = undefined;

	$scope.backButtonClick = function() {
		if ($scope.backButton && $scope.backButton.cb) {
			$scope.backButton.cb();
		}
	}

	$scope.clearBackCallback = function() {
		$scope.backButton = undefined;
	}

	$scope.setBackCallback = function(label, cb) {
		$scope.backButton = {label:label, cb:cb}
	}

	// active feed
	$scope.setActiveFeed = function(feed) {
		$scope.activeFeed = feed;
		if (!feed) {
			$scope.setTitle(undefined);
			return;
		}

		if (feed == $scope.opml) {
			$scope.setTitle("All items");
		}
		else {
			$scope.setTitle(feed.Title)
		}
		$scope.setMode('story');
	}
});

app.controller('FeedController', function($scope) {
	$scope.feeds = undefined;
	$scope.current = undefined;
	$scope.isRoot = true;

	$scope.$watch('opml', function(value) {
		if ($scope.mode != 'feed') return;
		if (!value) return;
		$scope.reload();
	}, true);

	$scope.$watch('mode', function(value) {
		if (value != 'feed') return;
		$scope.reload();
	});

	$scope.reset = function() {
		$scope.feeds = undefined;
	}

	$scope.reload = function() {
		var current = undefined;
		if ($scope.current) {
			if ($scope.current.Outline) {
				// find folder with the same title
				var title = $scope.current.Title;
				var current = undefined;
				for (var i=0; i<$scope.opml.length; i++) {
					var item = $scope.opml[i];
					if (item.Outline && item.Title == title) {
						current = item;
						break;
					}
				}
			}
		}

		// get the feeds
		if (!current) {
			current = $scope.opml;
		}
		$scope.setCurrent(current);
	}

	$scope.setCurrent = function(feed) {
		$scope.current = feed;
		$scope.isRoot = feed == $scope.opml;

		if (feed == $scope.opml) {
			$scope.feeds = $scope.opml;
		}
		else {
			$scope.feeds = feed.Outline;
		}

		$scope.updateBackButton();
		$scope.resetScroll();
	};

	$scope.updateBackButton = function() {
		if ($scope.current == $scope.opml) {
			$scope.clearBackCallback();
		}
		else {
			$scope.setBackCallback('&laquo; Back', function() {
				$scope.setCurrent($scope.opml);
			});
		}
	}

	$scope.open = function(feed) {
		if (feed.Outline) {
			$scope.openFolder(feed);
		}
		else {
			$scope.showFeed(feed);
		}
	};

	$scope.showAllItems = function() {
		$scope.setActiveFeed($scope.feeds);
	}

	$scope.openFolder = function(feed) {
		$scope.setCurrent(feed);
	}

	$scope.showFeed = function(feed) {
		$scope.setActiveFeed(feed);
	}

	$scope.showFolder = function(feed) {
		$scope.setActiveFeed(feed);
	}
});

app.controller('StoryController', ['$scope', '$http', function($scope, $http) {
	function collectFeeds(feed) {
		if (feed.Outline) feed = feed.Outline;

		if (isArray(feed)) {
			var feeds = [];
			for (var i=0; i<feed.length; i++) {
				var item = feed[i];
				if (item.Outline) {
					feeds = feeds.concat(collectFeeds(item));
				}
				else {
					feeds.push(item);
				}
			}
			return feeds;
		}
		else {
			return [feed];
		}
	}

	$scope.limit = 10;
	$scope.stories = [];
	$scope.activeStory = undefined;
	$scope.totalItems = 0;
	$scope.hasMoreItems = false;
	$scope.contents = {};
	$scope.readStatusChanges = [];

	$scope.$watch('$parent.stories', function(value) {
		if ($scope.mode != 'story') return;
		if (!value) return;
		$scope.reload();
	});

	$scope.$watch('opml', function(value) {
		$scope.setMode('feed');
	}, true);

	$scope.$watch('mode', function(value) {
		if (value != 'story') return;
		$scope.reload();
	});

	$scope.updateBackButton = function() {
		$scope.setBackCallback('&laquo; Feeds', function() {
			$scope.setMode('feed');
		});
	}

	$scope.reload = function() {
		$scope.updateBackButton();
		if (!$scope.activeFeed) {
			$scope.setMode('feed');
			return;
		}

		$scope.reset();
		$scope.prepareFeeds();
		$scope.resetScroll();
	};

	$scope.reset = function() {
		$scope.stories = [];
		$scope.contents = {};
		$scope.activeStory = undefined;
	}

	$scope.prepareFeeds = function() {
		$scope.feeds = collectFeeds($scope.activeFeed);
		$scope.updateStream();
		$scope.limit = Math.min(10, $scope.totalItems);
		$scope.updateStories();
		$scope.updateContents();
	}

	$scope.updateStream = function() {
		var source = $scope.$parent.stories;
		var stream = [];
		var total = 0;
		var feeds = $scope.feeds;
		for (var i=0; i<feeds.length; i++) {
			var feed = feeds[i];
			var url = feed.XmlUrl;
			if (source[url]) {
				stream.push({feed:feed, stories:source[url]});
				total += source[url].length;
			}
		}
		$scope.stream = stream;
		$scope.totalItems = total;
	}

	$scope.updateStories = function() {
		var stream = $scope.stream;
		var len = stream.length;

		var pos = [];
		for (var i=0; i<len; i++) pos.push(0);

		var stories = [];
		for (var i=0; i<$scope.limit; i++) {
			var idx = -1;
			for (var j=0; j<len; j++) {
				var p = pos[j];
				if (p < stream[j].stories.length) {
					if (idx<0) idx = j;
					else {
						if (stream[j].stories[pos[j]].Date < stream[idx].stories[pos[idx]].Date) {
							idx = j;
						}
					}
				}
			}
			if (idx<0) break;

			var story = stream[idx].stories[pos[idx]];
			story.feed = stream[idx].feed;
			if (story.Unread === undefined) {
				story.Unread = true; // FIXME get the unread status
			}
			stories.push(story);
			pos[idx]++;
		}

		$scope.stories = stories;
		$scope.hasMoreItems = $scope.limit < $scope.totalItems;
	}

	$scope.show = function(story) {
		if ($scope.activeStory == story) return;
		$scope.activeStory = story;
		$scope.setRead(story);
	}

	$scope.hide = function() {
		$scope.activeStory = undefined;
	}

	$scope.showIndex = function(index) {
		if (index<0 || index>=$scope.stories.length) return;
		var story = $scope.stories[index];
		$scope.show(story);
	}

	$scope.loadMore = function() {
		$scope.limit = Math.min($scope.limit + 10, $scope.totalItems);
		$scope.updateStories();
		$scope.updateContents();
	}

	$scope.updateContents = function() {
		var items = [];
		for (var i=0; i<$scope.stories.length; i++) {
			var story = $scope.stories[i];
			var feed = story.feed;
			if (!$scope.contents[feed.XmlUrl] || !$scope.contents[feed.XmlUrl][story.Id]) {
				items.push({Feed: feed.XmlUrl, Story: story.Id});
			}
		}
		$scope.loadContents(items);
	}

	$scope.setContent = function(XmlUrl, Id, content) {
		if (!$scope.contents[XmlUrl])
			$scope.contents[XmlUrl] = {};
		$scope.contents[XmlUrl][Id] = content;
	}

	$scope.loadContents = function(items) {
		$http.post($scope.url.contents, items)
			.success(function(data) {
				for (var i=0; i<data.length; i++) {
					$scope.setContent(items[i].Feed, items[i].Story, data[i]);
				}
			});
	}

	$scope.updateReadStatus = _.debounce(function() {
		// FIXME is race condition possible?
		var changes = $scope.readStatusChanges.slice();
		$scope.readStatusChanges = [];

		var unread = [];
		var read = [];

		var added = {};
		for (var i=changes.length-1; i>=0; i--) {
			var item = changes[i];
			var key = [item.Feed, item.Story];
			if (!(key in added)) {
				added[key] = true;
				if (item.Unread) unread.push(item);
				else read.push(item);
			}
		}

		// TODO batch mark unread/read
		angular.forEach(unread, function(item) {
			$scope.http('POST', $scope.url.markUnread, {
				feed: item.Feed,
				story: item.Story
			});
		});
		angular.forEach(read, function(item) {
			$scope.http('POST', $scope.url.markRead, {
				feed: item.Feed,
				story: item.Story
			});
		});
	}, 2000);

	$scope.setRead = function(story) {
		if (!story.Unread) return;
		story.Unread = false;
		$scope.scheduleReadStatus(story);
	}

	$scope.scheduleReadStatus = function(story) {
		$scope.readStatusChanges.push({
			Feed: story.feed.XmlUrl,
			Story: story.Id,
			Unread: story.Unread
		});
		$scope.updateReadStatus();
	}

	$scope.toggleRead = function(story) {
		$scope.scheduleReadStatus(story);
	}

	$scope.markItemsRead = function() {
		for (var i=0; i<$scope.stories.length; i++) {
			var story = $scope.stories[i];
			if (story.Unread) {
				story.Unread = false;
				$scope.scheduleReadStatus(story);
			}
		}
		// TODO refresh list
	}
}]);

})();

