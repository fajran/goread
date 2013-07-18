(function() {

function isArray(value) {
	return Object.prototype.toString.call(value) === '[object Array]';
}

var app = angular.module('goReadMobileApp', []);

app.filter('encodeURI', function() {
	return encodeURIComponent;
});

app.config(function($locationProvider) {
	return $locationProvider.html5Mode(true);
});

app.controller('MainController', function($scope, $http) {
	$scope.loading = 1;
	$scope.title = ''
	$scope.activeFeed = undefined;

	$scope.setLoaded = function() {
		$scope.loading = 0;
	}

	function collectUrls() {
		$scope.url = {
			feeds: $('body').data('url-feeds')
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

				// TODO: move this out
				$scope.setLoaded();
				$scope.setMode('feed');
			})
			.error(function(data, status) {
				// TODO
			});
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
	});

	$scope.updateBackButton = function() {
		if (!$scope.current) {
			$scope.clearBackCallback();
		}
		else {
			$scope.setBackCallback('<< Back', function() {
				$scope.feeds = $scope.opml;
				$scope.current = undefined;
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
	}

	$scope.showFeed = function(feed) {
		$scope.setActiveFeed(feed);
	}

	$scope.showFolder = function(feed) {
		$scope.setActiveFeed(feed);
	}
});

app.controller('StoryController', function($scope) {
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

	$scope.$watch('mode', function(value) {
		if (value != 'story') return;

		$scope.setBackCallback('<< Feeds', function() {
			$scope.setMode('feed');
		});

		if (!$scope.activeFeed) return;

		$scope.feeds = collectFeeds($scope.activeFeed);
	});
});

})();

