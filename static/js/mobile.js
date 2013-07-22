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

app.filter('truncateNumber', function() {
	return function(value, max) {
		value = parseInt(value);
		max = parseInt(max);
		if (value > max) {
			return max + '+';
		}
		return value;
	}
});

app.controller('MainController', function($scope, $http) {
	$scope.loading = 1;
	$scope.title = ''
	$scope.activeFeed = undefined;
	$scope.visibility = 'unread';
	$scope.accountType = 0;

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
			addSubscription: $('body').data('url-add-subscription'),
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

	// account

	$scope.showAccount = function() {
		$scope.setMode('account');
	}

	$scope.setAccountType = function(type) {
		$scope.accountType = type;
	}

	// UI

	$scope.scrollToTop = function() {
		$scope.$evalAsync(function() {
			$(window).scrollTop(0);
		});
	}

	$scope.scrollToHead = function() {
		$scope.$evalAsync(function() {
			$(window).scrollTop($('.nav.top')[0].offsetTop);
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

	// visibility
	$scope.setVisibility = function(visibility) {
		$scope.visibility = visibility;
	}

	// utils

	$scope.isStoryRead = function(story) {
		return story.Unread === false;
	}

	// subscription

	$scope.addSubscription = function() {
		var url = prompt('Enter URL of a feed');
		url = $.trim(url);
		if (url === '') return;

		$scope.loading++;
		$scope.http('POST', $scope.url.addSubscription, {
				url: url
			})
			.success(function(data) {
				$scope.loadFeeds();
			})
			.error(function(data) {
				alert('Error: ' + data);
				$scope.loading--;
			});
	}
});

app.controller('FeedController', function($scope) {
	$scope.feeds = undefined;
	$scope.current = undefined;
	$scope.isTop = true;
	$scope.unread = undefined;

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
		$scope.resetUnreadCount();
		$scope.resetCurrentView();
	}

	$scope.getUnreadCount = function(feed) {
		if (!feed || !$scope.unreadCount) {
			return 0;
		}
		if (feed.Outline) {
			return $scope.unreadCount.folders[feed.Title];
		}
		else {
			return $scope.unreadCount.feeds[feed.XmlUrl];
		}
	}

	$scope.resetUnreadCount = function() {
		var unread = {
			all: 0,
			folders: {},
			feeds: {}
		}

		if (!$scope.opml || !$scope.stories) {
			$scope.unreadCount = unread;
			return;
		}

		var countUnread = function(stories) {
			if (!stories) return 0;
			var count = 0;
			for (var i=0; i<stories.length; i++) {
				var story = stories[i];
				if (!$scope.isStoryRead(story)) {
					count++;
				}
			}
			return count;
		}

		for (var i=0; i<$scope.opml.length; i++) {
			var feed = $scope.opml[i];
			if (feed.Outline) {
				unread.folders[feed.Title] = 0;
				for (var j=0; j<feed.Outline.length; j++) {
					var child = feed.Outline[j];
					var url = child.XmlUrl;
					var count = countUnread($scope.stories[url]);
					unread.all += count;
					unread.folders[feed.Title] += count;
					unread.feeds[url] = count;
				}
			}
			else {
				var url = feed.XmlUrl;
				var count = countUnread($scope.stories[url]);
				unread.all += count;
				unread.feeds[url] = count;
			}
		}

		$scope.unreadCount = unread;
	}

	$scope.resetCurrentView = function() {
		// determine currently opened feed
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
		$scope.isTop = feed == $scope.opml;

		if (feed == $scope.opml) {
			$scope.feeds = $scope.opml;
		}
		else {
			$scope.feeds = feed.Outline;
		}

		$scope.updateBackButton();
		if ($scope.isTop) {
			$scope.scrollToTop();
		}
		else {
			$scope.scrollToHead();
		}
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

	// UI things
	$scope.resetScrollLeft = function() {
		$('#feed-list > ul > li').scrollLeft(0);
	}
});

app.controller('StoryController', ['$scope', '$http', '$timeout', function($scope, $http, $timeout) {
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

	$scope.stories = [];
	$scope.activeStory = undefined;
	$scope.pos = undefined;
	$scope.hasMoreItems = false;
	$scope.contents = {};
	$scope.readStatusChanges = [];
	$scope.keepUnread = [];

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

	$scope.$watch('visibility', function(value) {
		if ($scope.mode != 'story') return;
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
		$scope.scrollToHead();
	};

	$scope.reset = function() {
		$scope.stories = [];
		$scope.contents = {};
		$scope.activeStory = undefined;
		$scope.pos = undefined;
		$scope.keepUnread = [];
	}

	$scope.prepareFeeds = function() {
		$scope.feeds = collectFeeds($scope.activeFeed);
		$scope.updateStream();
		$scope.loadMoreStories();
	}

	$scope.updateStream = function() {
		var source = $scope.$parent.stories;
		var stream = [];
		var feeds = $scope.feeds;
		for (var i=0; i<feeds.length; i++) {
			var feed = feeds[i];
			var url = feed.XmlUrl;
			if (source[url]) {
				var stories = source[url];
				if (!stories.$gr$sorted) {
					stories.sort(function(a, b) {
						return b.Date - a.Date;
					});
					stories.$gr$sorted = true;
				}
				stream.push({feed:feed, stories:stories});
			}
		}
		$scope.stream = stream;
	}

	$scope.loadNextBatch = function() {
		var stream = $scope.stream;
		var len = stream.length;

		var pos = $scope.pos;
		if (pos === undefined) {
			pos = [];
			for (var i=0; i<len; i++) pos.push(0);
		}

		var showRead = $scope.visibility == 'all';

		var stories = $scope.stories.slice();
		var hasMore = true;
		for (var i=0; i<10; i++) {
			var next = undefined;
			var idx = -1;
			for (var j=0; j<len; j++) {
				while (pos[j] < stream[j].stories.length) {
					var story = stream[j].stories[pos[j]];
					if ($scope.isStoryRead(story) && !showRead) {
						pos[j]++;
						continue;
					}

					if (!next) {
						next = story;
						next.feed = stream[j].feed;
						idx = j;
					}
					else {
						if (story.Date > next.Date) {
							next = story;
							next.feed = stream[j].feed;
							idx = j;
						}
					}
					break;
				}
			}
			if (!next) {
				hasMore = false;
				break;
			}

			if (next.Unread === undefined) {
				next.Unread = true; // FIXME get the unread status
			}
			stories.push(next);
			pos[idx]++;
		}

		$scope.pos = pos;
		$scope.stories = stories;
		$scope.hasMoreItems = hasMore;
	}

	$scope.$watch('stories', function(values) {
		var count = 0;
		angular.forEach(values, function(story) {
			if (story.Unread) {
				count += 1;
			}
		});
		$scope.unreadCount = count;
	}, true);

	$scope.show = function(story) {
		if ($scope.activeStory == story) return;
		$scope.activeStory = story;
		$scope.setRead(story);
		if (!$scope.hasContent(story)) {
			$scope.loadContents([story]);
		}
		$scope.scrollToStory(story);
	}

	$scope.hide = function() {
		$scope.activeStory = undefined;
	}

	$scope.showIndex = function(index) {
		if (index<0 || index>=$scope.stories.length) return;
		var story = $scope.stories[index];
		$scope.show(story);
	}

	$scope.scrollToStory = function(story) {
		$timeout(function() {
			var index = $scope.stories.indexOf(story);
			var el = $('#story-list > ul > li.story')[index];
			$(window).scrollTop(el.offsetTop);
		}, 0);
	}

	$scope.loadMoreStories = function() {
		$scope.loadNextBatch();
		$scope.updateContents();
	}

	$scope.hasContent = function(story) {
		var feed = story.feed;
		return $scope.contents[feed.XmlUrl] && $scope.contents[feed.XmlUrl][story.Id];
	}

	$scope.updateContents = function() {
		var items = [];
		for (var i=0; i<$scope.stories.length; i++) {
			var story = $scope.stories[i];
			if (!$scope.hasContent(story)) {
				items.push(story);
			}
		}
		$scope.loadContents(items);
	}

	$scope.setContent = function(XmlUrl, Id, content) {
		if (!$scope.contents[XmlUrl])
			$scope.contents[XmlUrl] = {};
		$scope.contents[XmlUrl][Id] = content;
	}

	$scope.loadContents = function(stories) {
		var items = [];
		for (var i=0; i<stories.length; i++) {
			var story = stories[i];
			var feed = story.feed;
			items.push({Feed: feed.XmlUrl, Story: story.Id});
		}
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
		if ($scope.keepUnread.indexOf(story) == -1) {
			$scope.keepUnread.push(story);
		}
	}

	$scope.markItemsRead = function() {
		for (var i=0; i<$scope.stories.length; i++) {
			var story = $scope.stories[i];
			var keep = $scope.keepUnread.indexOf(story) >= 0 && story.Unread;
			if (!keep && story.Unread) {
				story.Unread = false;
				$scope.scheduleReadStatus(story);
			}
		}
		$scope.keepUnread = [];
		if ($scope.visibility == 'unread') {
			$scope.reload();
		}
		else {
			$scope.setVisibility('unread');
		}
	}

	// UI things
	$scope.resetScrollLeft = function() {
		$('#story-list > ul > li').scrollLeft(0);
	}
}]);

app.controller('AccountController', ['$scope', '$http', function($scope, $http) {
	$scope.account = undefined;
	$scope.accountType = 0; // shadow value

	$scope.$watch('mode', function(value) {
		if (value != 'account') return;
		$scope.reload();
	});

	$scope.reload = function() {
		$scope.loadCheckout();
		$scope.loadAccountData();
		$scope.updateBackButton();
	}

	$scope.updateBackButton = function() {
		$scope.setBackCallback('&laquo; Back', function() {
			$scope.setMode('feed');
		});
	}

	$scope.$watch('accountType', function(value) {
		// Watch the AccountController's accountType value
		// when it's changed, update the MainController's value.
		// FIXME: Why? to keep checkout() and unCheckout() intact
		// just like what they are in site.js
		$scope.setAccountType(value);
	});

	// misc

	$scope.date = function(d) {
		var m = moment(d);
		if (!m.isValid()) return d;
		return m.format('D MMMM YYYY');
	};

	// stripe

	var checkoutLoaded = false;

	$scope.loadAccountData = function() {
		if ($scope.account) return;
		$http.get($('#account').attr('data-url-account'))
			.success(function(data) {
				$scope.account = data;
			});
	};

	$scope.loadCheckout = function(cb) {
		if (!checkoutLoaded) {
			$.getScript("https://checkout.stripe.com/v2/checkout.js", function() {
				checkoutLoaded = true;
				if (cb) cb();
			});
		} else {
			if (cb) cb();
		}
	};

	// donation

	$scope.donate = function() {
		$scope.loadCheckout(function() {
			var token = function(res){
				var button = $('#donateButton');
				button.button('loading');
				$scope.http('POST', $('#account').attr('data-url-donate'), {
						stripeToken: res.id,
						amount: $scope.donateAmount * 100
					})
					.success(function(data) {
						button.button('reset');
						alert('Thank you');
					})
					.error(function(data) {
						button.button('reset');
						console.log(data);
						alert('Error');
					});
			};
			StripeCheckout.open({
				key: $('#account').attr('data-stripe-key'),
				amount: $scope.donateAmount * 100,
				currency: 'usd',
				name: 'Go Read',
				description: 'Donation',
				panelLabel: 'Donate',
				token: token
			});
		});
	};

	// subscription

	$scope.checkout = function(plan, desc, amount) {
		$scope.loadCheckout(function() {
			var token = function(res){
				var button = $('#button' + plan);
				button.button('loading');
				$scope.http('POST', $('#account').attr('data-url-charge'), {
					token: res.id,
					plan: plan
				})
					.success(function(data) {
						button.button('reset');
						$scope.accountType = 2;
						$scope.account = data;
					})
					.error(function(data) {
						button.button('reset');
						alert(data);
					});
			};
			StripeCheckout.open({
				key: $('#account').attr('data-stripe-key'),
				amount: amount,
				currency: 'usd',
				name: 'Go Read',
				description: desc,
				panelLabel: 'Subscribe for',
				token: token
			});
		});
	};

	$scope.unCheckout = function() {
		if (!confirm('Sure you want to unsubscribe?')) return;
		var button = $('#uncheckoutButton');
		button.button('loading');
		$http.post($('#account').attr('data-url-uncheckout'))
			.success(function() {
				delete $scope.account;
				$scope.accountType = 0;
				button.button('reset');
				alert('Unsubscribed');
			})
			.error(function() {
				button.button('reset');
				console.log(data);
				alert('Error');
			});
	};

}]);

})();

