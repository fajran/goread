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

	function collectUrls() {
		$scope.url = {
			feeds: $('body').data('url-feeds'),
			contents: $('body').data('url-contents')
		}
	}

	$scope.init = function() {
		collectUrls();
		$scope.loadFeeds();
	}

	$scope.loadFeeds = function(cb) {
		cb = cb || function() {};

		$http.get($scope.url.feeds)
			.success(function(data) {
				$scope.opml = data.Opml;
				$scope.stories = data.Stories;

				// TODO: move this out
				$scope.setLoaded();
				$scope.setMode('feed');
			})
			.error(function(data, status) {
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

	$scope.$watch('mode', function(value) {
		if (value != 'feed') return;

		if ($scope.current == undefined) {
			$scope.feeds = $scope.opml;
		}
		$scope.updateBackButton();
		$scope.resetScroll();
	});

	$scope.updateBackButton = function() {
		if (!$scope.current) {
			$scope.clearBackCallback();
		}
		else {
			$scope.setBackCallback('&laquo; Back', function() {
				$scope.feeds = $scope.opml;
				$scope.current = undefined;
				$scope.resetScroll();
			});
		}
	}

	$scope.$watch('feeds', function(value) {
		$scope.updateBackButton();
	});

	$scope.$watch('current', function(value) {
		$scope.updateBackButton();
	});

	$scope.activate = function(feed) {
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
		$scope.current = feed;
		$scope.feeds = feed.Outline;
		$scope.resetScroll();
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

	$scope.$watch('mode', function(value) {
		if (value != 'story') return;

		$scope.setBackCallback('&laquo; Feeds', function() {
			$scope.setMode('feed');
		});

		if (!$scope.activeFeed) return;

		$scope.reset();
		$scope.load();
		$scope.resetScroll();
	});

	$scope.reset = function() {
		$scope.stories = [];
		$scope.contents = {};
		$scope.activeStory = undefined;
	}

	$scope.load = function() {
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
			stories.push(story);
			pos[idx]++;
		}

		$scope.stories = stories;
		$scope.hasMoreItems = $scope.limit < $scope.totalItems;
	}

	$scope.show = function(story) {
		$scope.activeStory = story;
	}

	$scope.hide = function() {
		$scope.activeStory = undefined;
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
}]);

})();

