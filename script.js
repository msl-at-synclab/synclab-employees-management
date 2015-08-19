var app = angular.module('syncLabEmployeesManagementApp', ['ui.bootstrap', 'ngRoute']);

app.config(['$routeProvider', function($routeProvider) {
	$routeProvider.
		when('/home', {
			templateUrl: 'home.html',
			controller: 'HomeController',
		}).
		when('/login', {
			templateUrl: 'login.html',
			controller: 'LoginController'
		}).
		when('/compila_ril', {
			templateUrl: 'compila_ril.html',
			controller: 'CompilaRilController'
		}).
		when('/logout', {
			templateUrl: 'logout.html',
			controller: 'LogoutController'
		}).
		otherwise({ redirectTo: '/home' });
}]);

app.factory('users', ['$q', '$timeout', function($q, $timeout) {
	var users_list = [
		{ id: 1, username: 'marcoliceti', password: 'marcoliceti123456', role: 'dipendente' },
		{ id: 2, username: 'ddellatorre', password: 'ddellatorre123456', role: 'dipendente' },
		{ id: 3, username: 'admin', password: 'admin', role: 'amministratore' }
	];

	function userWithUsername(username) {
		for (var i = 0; i < users_list.length; i++) {
			var user = users_list[i];
			if (user.username === username) return user;
		}
	}

	return {
		get: function (filters) {
			var deferred = $q.defer();

			$timeout(function () {
				var result;
				if (!filters) result = users_list;
				else if (filters.username) result = userWithUsername(filters.username);
				deferred.resolve(result);
			}, 1000);

			return deferred.promise;
		}
	};   
}]);

app.factory('login', ['$q', 'users', function($q, users) {
	return {
		tryLogin: function (username, password) {
			var deferred = $q.defer();

			var user = users.get({ username: username }).then(function (user) {
				var result;
				if (!user) result = { success: false, error: { not_found: true } };
				else if (user && user.password !== password) result = { success: false, error: { wrong_password: true } };
				else result = { success: true, user: user };
				deferred.resolve(result);
			});

			return deferred.promise;
		}
	};   
}]);

app.factory('session', [function() {
	return {
		load: function (key) {
			var json_string = localStorage.getItem(key);
			return JSON.parse(json_string);
		},

		save: function (key, value) {
			localStorage.setItem(key, JSON.stringify(value));
		},

		remove: function (key) {
			localStorage.removeItem(key);
		}
	};   
}]);

app.factory('calendar', [function() {
	function leap(year) {
		return (year % 4 === 0 && !(year % 100 === 0)) || (year % 400 === 0);
	}

	function numberOfDaysIn(month, year) {
		var cases = [
			31,
			leap(year) ? 29 : 28,
			31,
			30,
			31,
			30,
			31,
			31,
			30,
			31,
			30,
			31
		];
		return cases[month - 1];
	}

	function daysBetweenYears(y1, y2) {
		var days = 0;

		while (y1 < y2) {
			days += leap(y1) ? 366 : 365;
			y1++;
		}

		return days;
	};

	function daysInYear(day, month, year) {
		var days = 0;
		var curr_month = 1;
		while (curr_month < month) {
			days += numberOfDaysIn(curr_month, year);
			curr_month++;
		}
		return days + day - 1;
	};

	function daysInCentury(day, month, year) {
		var days_between_years = daysBetweenYears(2000, year);
		var days_in_year = daysInYear(day, month, year);
		return days_between_years + days_in_year;
	}

	function dayOfWeek(day, month, year) {
		var days_in_century = daysInCentury(day, month, year);
		return 1 + ((5 + days_in_century) % 7); // 1st January 2000 was a Saturday
	}

	return {
		getDaysOfMonth: function (month, year) {
			var days = [];

			for (var i = 1; i <= numberOfDaysIn(month, year); i++) {
				var day_of_week = dayOfWeek(i, month, year);
				if (day_of_week !== 6 && day_of_week !== 7) days.push({
					day_of_month: i,
					day_of_week: day_of_week
				});
			}

			return days;
		}
	};   
}]);

app.factory('ril_repository', ['$q', '$timeout', function($q, $timeout) {
	return {
		load: function (month, year) {
			var deferred = $q.defer();

			$timeout(function () {
				var json_string = localStorage.getItem('ril_' + month + '_' + year);
				var rils = json_string ? JSON.parse(json_string) : null;
				deferred.resolve(rils);
			}, 1000);

			return deferred.promise;
		},

		save: function (rils, month, year) {
			var deferred = $q.defer();

			localStorage.setItem('ril_' + month + '_' + year, JSON.stringify(rils));
			deferred.resolve();

			$timeout(function () {
				localStorage.setItem('ril_' + month + '_' + year, JSON.stringify(rils));
				deferred.resolve();
			}, 1000);

			return deferred.promise;
		}
	};
}]);

app.factory('ril_service', ['$q', 'calendar', 'ril_repository', function($q, calendar, ril_repository) {
	return {
		newEmptyRil: function (month, year) {
			var days_of_month = calendar.getDaysOfMonth(month, year);
			var ril = {
				month: month,
				year: year,
				rows: []
			};
			for (var i = 0; i < days_of_month.length; i++) {
				ril.rows.push({
					day: days_of_month[i],
					data: {
						absence: 'no',
						business_trip: 'no'
					},
					status: { incomplete: true }
				});
			}
			return ril;
		},

		search: function (filters) {
			var me = this;
			if (filters.month && filters.year) {
				var deferred = $q.defer();

				ril_repository.load(filters.month, filters.year).then(function (rils) {
					if (filters.user) {
						var ril;
						if (rils) {
							var user_ids = Object.keys(rils);
							for (var i = 0; i < user_ids.length; i++) {
								var user_id = user_ids[i];
								if (user_id == filters.user.id) ril = rils[user_id];
							}
						}
						if (!ril) ril = me.newEmptyRil(filters.month, filters.year);
						deferred.resolve(ril);
					} else deferred.resolve(rils);
				});

				return deferred.promise;
			}
		},

		save: function (ril, user) {
			var deferred = $q.defer();

			this.search({ month: ril.month, year: ril.year }).then(function (rils) {
				if (rils) {
					var user_ids = Object.keys(rils);
					for (var i = 0; i < user_ids.length; i++) {
						var user_id = user_ids[i];
						if (user_id == user.id) {
							rils[user_id] = ril;
						}
					}
					if (!rils[user.id]) rils[user.id] = ril;
				} else {
					rils = {};
					rils[user.id] = ril;
				}

				ril_repository.save(rils, ril.month, ril.year).then(function () {
					deferred.resolve();
				});
			});

			return deferred.promise;
		}
	};
}]);

app.factory('ril_checker', [function() {
	function checkCompleteness(row) {
		var in_out_ok = row.data.entrance && row.data.exit;
		var absence = row.data.absence !== 'no';
		row.status.incomplete = (in_out_ok || absence) ? false : true;
	}

	function checkValidity(row) {
		var entrance_exit_ok;
		var absence = row.data.absence !== 'no';
		if (absence) {
			entrance_exit_ok = !row.data.entrance && !row.data.exit;
		} else {
			var hour_regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
			var entrance_ok = hour_regex.test(row.data.entrance);
			var exit_ok = hour_regex.test(row.data.exit);
			var entrance_lower_than_exit = row.data.entrance < row.data.exit;
			var entrance_exit_ok = entrance_ok && exit_ok && entrance_lower_than_exit;
		}
		var business_trip_ok = row.data.business_trip_notes ? (row.data.business_trip !== 'no') : true;
		row.status.valid = entrance_exit_ok && business_trip_ok;
	}

	return {
		checkRow: function (row) {
			checkCompleteness(row);
			checkValidity(row);
		}
	};   
}]);

app.controller('MenuController', ['$scope', '$location', 'session', function($scope, $location, session) {
	$scope.items = [
		{ name: 'home', text: 'Home', path: '/home' },
		{ name: 'login', text: 'Login', path: '/login', hide_after_login: true },
		{ name: 'compila_ril', text: 'Compila RIL', path: '/compila_ril', requires_login: true, requires_role: 'dipendente' },
		{ name: 'logout', text: 'Logout', path: '/logout', requires_login: true }
	];

	var items = $scope.items;

	function itemForPath(path) {
		for (var i = 0; i < items.length; i++) if (items[i].path === path) return items[i];
	}

	function pathForItemWithName(name) {
		for (var i = 0; i < items.length; i++) if (items[i].name === name) return items[i].path;
	}

	$scope.$watch(
		function () {
			return $location.path();
		},
		function (new_path, old_path) {
			var old_item = itemForPath(old_path);
			var new_item = itemForPath(new_path);
			if (old_item) old_item.selected = false;
			if (new_item) {
				new_item.selected = true;
				$location.path(new_item.path);
			}
		}
	);

	$scope.$watch(
		function () {
			return session.load('user');
		},
		function (user) {
			$scope.user = user;
		},
		true
	);    
}]);

app.controller('HomeController', ['$scope', function($scope) {
}]);

app.controller('LoginController', ['$scope', 'login', 'session', function($scope, login, session) {
	$scope.tryLogin = function () {
		$scope.trying_login = true;
		login.tryLogin($scope.username, $scope.password).then(function (result) {
			$scope.trying_login = false;
			if (result.success) {
				session.save('user', result.user);
				$scope.user = result.user;
			}
			else $scope.error = result.error;
		});
	};
}]);

app.controller('CompilaRilController', ['$scope', 'ril_service', 'session', function($scope, ril_service, session) {
	var today = new Date();
	$scope.month = today.getMonth() + 1;
	$scope.year = today.getFullYear();

	$scope.days_of_week = [ 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì' ];
	$scope.months = [ 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre' ];
	
	var search_params = { user: session.load('user'), month: $scope.month, year: $scope.year };
	ril_service.search(search_params).then(function (ril) { $scope.ril = ril; });

	$scope.anyCompleteButInvalid = function () {
		if ($scope.ril) {
			var rows = $scope.ril.rows;
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				if (!row.status.incomplete && !row.status.valid) return true;
			}
			return false;
		}
	}

	$scope.fillWithStandardWorkHours = function () {
		var rows = $scope.ril.rows;
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			row.data.entrance = '09:00';
			row.data.exit = '18:00';
		}
	};

	$scope.cloneFirstRow = function () {
		var rows = $scope.ril.rows;
		var first_row = rows[0];
		for (var i = 1; i < rows.length; i++) {
			var row = rows[i];
			row.data = angular.copy(first_row.data);
		}
	};

	$scope.save = function () {
		$scope.saving = true;
		var user = session.load('user');
		ril_service.save($scope.ril, user).then(function () {
			$scope.saving = false;
		});
	};

	$scope.reset = function () {
		$scope.ril = ril_service.newEmptyRil($scope.month, $scope.year);
	};
}]);

app.controller('CompilaRigaRilController', ['$scope', 'ril_checker', function($scope, ril_checker) {
	$scope.$watch(
		function () { return $scope.row; },
		function (row) {
			ril_checker.checkRow(row);
		},
		true
	);
}]);

app.controller('LogoutController', ['$scope', 'session', function($scope, session) {
	$scope.logout = function () {
		session.remove('user');
		$scope.logged_out = true;
	};
}]);