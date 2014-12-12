var model = {

	words: false,

	dico: false,
	
	//Toolbox

	toolbox: {
		ajax: function(fichier, callback){
			var xmlhttp = new XMLHttpRequest();
			xmlhttp.onreadystatechange = function(){
				if (xmlhttp.readyState==4 && xmlhttp.status==200)
					if(typeof callback !="undefined"){callback.call(this, xmlhttp.responseText);}
			};
			xmlhttp.open("GET", fichier, true);
			xmlhttp.setRequestHeader("Content-Type", "charset=utf-8");
			xmlhttp.send(null);
		}
	},

	// INIT
	initFirebase: function(){
		this.firebase = new Firebase('https://torid-inferno-6438.firebaseio.com/mots');
	},

	initUser: function(){

		var user = JSON.parse(localStorage.getItem('EchoUser'));

		if(!user){
			user = {
				age: 'unknown',
				sexe: 'unknown'
			};

			localStorage.setItem('EchoUser', JSON.stringify(user));

			model.newUser = true;
		}

		this.user = user;
	},

	// GET
	getDico: function(){
		model.toolbox.ajax("res/liste.de.mots.francais.frgut.txt", function(data){
			model.dico = data.split(/\n/g); // On analyse ligne par ligne
		});
	},

	watchData: function(callback){
		this.firebase.on('value', function (snapshot) {
			//GET DATA
			model.words = snapshot.val();
			callback.call(this, snapshot.val());
		});
	},

	getDataOnce: function(callback){
		this.firebase.once("value", function (snapshot) {
			//GET DATA
			model.words = snapshot.val();
			callback.call(this, snapshot.val());
		});
	},

	getRandomWord: function(){
		return model.words.nodes[Math.ceil(Math.random()*(model.words.nodes.length))-1].name;
	},

	getNodeFromWord: function(word){

		var node = false;

		var BreakException = {};

		try {

			model.words.nodes.forEach(function(element, index){
				if(word.toLowerCase() === element.name.toLowerCase()){
					node = element;
					throw BreakException;
				}
			});

		} catch(e) {

		    if (e !== BreakException) throw e;
		}

		return node;
	},

	getNodeFromIndex: function(index){

		var node = false;

		var BreakException = {};

		try {

			model.words.nodes.forEach(function(element, index){
				if(index === element.index){
					node = element;
					throw BreakException;
				}
			});

		} catch(e) {

		    if (e !== BreakException) throw e;
		}

		return node;
	},


	//ApplyFilters
	applyFilters: function(words, filters, callback){

		//Compatibilité IE pour la methode filter de Array
		if (!Array.prototype.filter) {
			Array.prototype.filter = function(fun /*, thisp*/) {
				var len = this.length >>> 0;
				if (typeof fun != "function"){
					throw new TypeError();
				}

				var res = [];
				var thisp = arguments[1];
				for (var i = 0; i < len; i++) {
					if (i in this) {
						var val = this[i]; // in case fun mutates this
						if (fun.call(thisp, val, i, this)){
							res.push(val);
						}
					}
				}
				return res;
			};
		}

		var filteredWords = {};

		if(filters.sexe && filters.age){

			filteredWords.nodes = words.nodes.filter(function (node) {
				return	node.sexe && node.sexe === filters.sexe &&
						node.age && filters.age.min <= node.age && node.age < filters.age.max;
			});

		}else if(filters.sexe){

			filteredWords.nodes = words.nodes.filter(function (node) {
				return	node.sexe && node.sexe === filters.sexe;
			});

		}else if(filters.age){

			filteredWords.nodes = words.nodes.filter(function (node) {
				return	node.age && filters.age.min <= node.age && node.age < filters.age.max;
			});
		}

		filteredWords.links = words.links.filter(function (link) {

			return	(function(link){
				var ok = false;
				var BreakException = {};
				try{
					filteredWords.nodes.forEach(function(node, index){
						if(link.source === node.index){
							link.source = index;
							ok = true;
							throw BreakException;
						}
					});
				} catch(e) {
					if (e !== BreakException) throw e;
				}
				return ok;
			})(link) 

			&&

			(function(link){
				var ok = false;
				var BreakException = {};
				try{
					filteredWords.nodes.forEach(function(node, index){
						if(link.target === node.index){
							link.target = index;
							ok = true;
							throw BreakException;
						}
					});
				} catch(e) {
					if (e !== BreakException) throw e;
				}
				return ok;
			})(link);
		});

		callback.call(this, filteredWords);

	},

	// CREATE
	createNode: function(newWord){
		var newNode = {
			name: newWord,
			index: model.words.nodes.length,
			nbLinks: 0,
			sexe: model.user.sexe,
			age: model.user.age
		};

		model.words.nodes.push(newNode);

		//this.firebase.child('nodes').set(model.words.nodes); //pose des problèmes sur l'ajout d'un node sans recharger le graph

		return newNode;
	},

	createLink: function(sourceNode, targetNode){
		var newLink = {
			source: sourceNode.index,
			target: targetNode.index,
			value: 1
		};

		//incrémente le nb de laison des nodes cocernés

		model.words.nodes[sourceNode.index].nbLinks += 1;
		model.words.nodes[targetNode.index].nbLinks += 1;

		model.words.links.push(newLink);

		this.firebase.set(model.words);
	},

	// ADD
	addContribution: function(newWord, proposedWord, successCallback, errorCallback){

		if(!newWord || !proposedWord) { console.log('argument manquant pour addContribution'); return; }

		if(model.isAFrenchWord(newWord)){ //le mot est français

			console.log('le mot est français');
			
			// si l'utilisateur est nouveau
			if(model.newUser){
				model.words.contributors += 1;
			}

			var node = model.getNodeFromWord(newWord),
				proposedNode = model.getNodeFromWord(proposedWord);

			if(node){ //le mot est déjà present dans le tableau nodes

				console.log('le mot est déjà present dans le tableau nodes');

				var link = model.areLinked(node, proposedNode);

				if(link){// les deux mots sont déjà liés entre eux

					console.log('les deux mots sont déjà liés entre eux');

					//on ajoute 1 à la value de la liaison link
					link.element.value += 1;
					
					this.firebase.child('links').child(link.index).set(link.element);

					successCallback.call(this);

				}else{ //les deux mots ne sont pas liés entre eux

					//on ajoute une liaison entre les deux mots

					if(node.index > proposedNode.index){
						model.createLink(node, proposedNode);
					}else{
						model.createLink(proposedNode, node);
					}

					successCallback.call(this);
				}
			}else{ //le mot n'est n'est pas présent dans le tableau nodes

				//on ajoute le mot dans le tableau nodes, et on ajoute une liaison entre newWord et proposedWord
				var newNode = model.createNode(newWord);

				model.createLink(newNode, proposedNode);

				successCallback.call(this);
			}
		}else{ //le mot n'est pas français

			//TODO message d'erreur
			var error = 'le mot n\'est pas français';
			console.log(error);
			errorCallback.call(this, error);
		}
	},

	// TEST
	isAFrenchWord: function(word){
		//TODO check si le mot est français, api google translate ?
		function isFrench(){
			var drapeau = false;
			var ligne = 0;
			// Répéter tant que le mot n'a pas été trouvé ou que le dictionnaire n'a pas été lu entièrement.
			while(drapeau === false && ligne < model.dico.length){
				if (model.dico[ligne].trim() == word) { // Si mot trouvé
					drapeau = true; // drapeau pour sortir de la boucle si on a trouvé le mot
				}
				ligne++; 
			}
				
			return drapeau;
		}

		if(model.dico){
			return isFrench();
		}
	},

	areLinked: function(node, proposedNode){

		function areLinked(source, target){
			var link = false;

			var BreakException = {};

			try {

				model.words.links.forEach(function(element, index){
					if(element.source === source && element.target === target){
						link = {
							index: index,
							element: element
						};
						throw BreakException;
					}
				});

			} catch(e) {

			    if (e !== BreakException) throw e;
			}

			return link;
		}
		
		if(node.index > proposedNode.index){
			return areLinked(node.index, proposedNode.index);
		}else{
			return areLinked(proposedNode.index, node.index);
		}
	}
};