var async = require("async")
var fs = require('fs')
var glob = require('glob')
var _ = require('lodash-node/underscore')
var basename = require("basename")
var https = require('follow-redirects').https
var url = require("url")
var request = require("request")
var admzip = require("adm-zip")
var mv = require("file-move")
var mkdir = require("mkpath")
var strconv = require("convert-string")

// The following options could be encapsulated in some sort of configuration object
// And read from a configuration file from the filesystem upon boot.
// That way, sensitive information isn't stored in git history.

// The github OAuth token you will use to pull down the private data repository
// Before running this script, be sure to set this accordingly to the user who has read access to data.
var githubToken = "12345"

// The repository that houses all of the digidem map filter data.
// It is encoded as "owner/repository" as found on github.com
var REGION_REPO = "kellydunn/fediquep-data"

// The Local Filesystem location in which
// the most recent version of master is stored.
var REGION_FS_STORAGE = "../" + REGION_REPO

// A toggle for offlline mode
var OFFLINE_MODE = true

// Return a list of odk instance filenames stored on usb drive
function read_usb_data(callback) {
    // For testing purposes, a data folder is supplied in the project on the local filesystem.
    // This should be changed to the actual USB mount path in order to retrieve data.
    glob("data/**/*.json", {}, function(err, files) {
        callback(files);
    })
}

module.exports.read_usb_data = read_usb_data;

function read_git_release_data(dir, callback) {
    glob(dir + "/*.json", {}, function(err, files) {
        callback(files);
    })
}

module.exports.read_git_release_data = read_git_relese_data;

function update_git_with_usb_data(usb_list, git_list, callback) {
    var files = []
    var usb_updates = _.difference(usb_list, git_list);
    _.each(usb_updates, function(e, i) {
        console.log("DIFF DETECTED " + basename(e));

        try {
            content = fs.readFileSync(e)
            files.push(new_file(content, basename(e) + ".json"))
        } catch(e) {
            console.log(e)
        }

    });
    
    add_odk_json_files(files, function(res) {
        console.log(res);
    })

    callback();
}

module.exports.update_git_with_usb_data = update_git_with_usb_data

function update_usb_with_git_data(usb_list, git_list, callback) {
    var git_updates = _.difference(git_list, usb_list);
    console.log(git_updates);

    _.each(git_updates, function(e, i) {
        console.log(basename(e));
        // TOOD implement updating usb data
    });
    
    callback();    
}

module.exports.update_usb_with_git_data = update_usb_with_git_data

function get_latest_release(repo, callback) {
    if (!OFFLINE_MODE) {
        var options = {
            host: 'api.github.com',
            port: 443,
            path: '/repos/' + repo + "/zipball/master",
            headers: {
                'Authorization': 'token ' + githubToken,
                'User-Agent': 'Fediquep Oil Contamination Montiors',
            }
        }
        
        https.get(options, function(res) {
            var data = [];
            var dataLen = 0;
            
            res.on('data', function(d) {
                data.push(d)
                dataLen += d.length
            });

            res.on('end', function() {
                var buf = new Buffer(dataLen);
                
                for (var i=0, len = data.length, pos = 0; i < len; i++) {
                    data[i].copy(buf, pos);
                    pos += data[i].length;
                }
                
                var zip = new admzip(buf);
                var zipEntries = zip.getEntries();
                zip.extractAllTo("../", true);
                
                try {
                    try { 
                        mkdir.sync(REGION_FS_STORAGE)
                    } catch(err) {
                        console.log(err);
                    }
                    
                    mv("../" + zipEntries[0].entryName, REGION_FS_STORAGE, function(err) {
                        console.log(err);
                        callback(REGION_FS_STORAGE);
                    })
                } catch(e) {
                    console.log(e)
                }
            })
        }).on('error', function(e) {
            console.error(e);
        });
    } else {
        callback(REGION_FS_STORAGE);
    }
}

module.exports.get_latest_release = get_latest_release;

// function for creating a commit when a new odk json file is introduced
function commit_tree(treeSha, masterSha, repo, callback) {
    var options = {
        url: 'https://api.github.com/repos/' + repo + "/git/commits",
        headers: {
            'Authorization': 'token ' + githubToken,
            'User-Agent': 'Fediquep Oil Contamination Montiors',
            'Content-Type': "application/json",
            'Accept':"application/json",
        },
        body: {
            "message" : "Appending data",
            "tree" : treeSha,
            "parents":[
                masterSha
            ],
        },
        json: true,
    }

    request.post(options, function(err, resp, jsonBody) {
        b = ""
        try {
            b = JSON.stringify(jsonBody)
        } catch(e) {
            console.log(e)
        }

        console.log(jsonBody)
        callback(jsonBody["sha"])
    })    
}

function get_master(repo, callback) {
    var options = {
        url: 'https://api.github.com/repos/' + repo + "/git/refs/heads/master",
        headers: {
            'Authorization': 'token ' + githubToken,
            'User-Agent': 'Fediquep Oil Contamination Montiors',
            'Content-Type': "application/json",
            'Accept':"application/json",
        },
    } 
   
    request.get(options, function(err, resp, jsonBody) {
        b = ""
        try {
            b = JSON.parse(jsonBody)
        } catch(e) {
            console.log(e)
        }

        console.log(jsonBody)
        callback(b["object"]["sha"])
    })    
}

function create_git_tree(files, repo, masterSha, callback) {
    var options = {
        url: 'https://api.github.com/repos/' + repo + "/git/trees",
        headers: {
            'Authorization': 'token ' + githubToken,
            'User-Agent': 'Fediquep Oil Contamination Montiors',
            'Content-Type': "application/json",
            'Accept':"application/json",
        },
        body: {
            base_tree: masterSha,
            tree: files
        },
        json: true,
    }

    filedata = ""
    try {
        filedata = JSON.stringify(files)
        console.log(filedata)
    } catch(e) {
        console.log(e)
    }
    
    request.post(options, function(err, resp, jsonBody) {
        b = ""
        try {
            b = JSON.stringify(jsonBody)
        } catch(e) {
            console.log(e)
        }

        console.log("ERROR: " + err)
        console.log("RESP: " + resp.statusCode)
        console.log(jsonBody)        
        callback(jsonBody["sha"])
    })        
}

function update_master(commitSha, repo, callback) {
    var options = {
        url: 'https://api.github.com/repos/' + repo + "/git/refs/heads/master",
        headers: {
            'Authorization': 'token ' + githubToken,
            'User-Agent': 'Fediquep Oil Contamination Montiors',
            'Content-Type': "application/json",
            'Accept':"application/json",
        },
        body: {
            sha: commitSha,
            force: true
        },
        json: true,
    }
    
    request.patch(options, function(err, resp, jsonBody) {
        b = ""
        try {
            b = JSON.stringify(jsonBody)
        } catch(e) {
            console.log(e)
        }

        console.log("RESP " + resp.statusCode)
        console.log("REFS MASTER :" + b)
        callback(b["sha"])
    })        
}

function add_odk_json_files(files, callback) {
    // Upload workflow
    data = ""
    try {
        data = JSON.stringify(files)
    } catch(e) {
        console.log(e)
    }

    console.log("Files " + data)
    get_master(REGION_REPO, function(masterSha) {
        console.log("CURRENT MASTER: " + masterSha);

        create_git_tree(files, REGION_REPO, masterSha, function(treeSha){
            console.log("NEW TREE: " + treeSha)
            
            commit_tree(treeSha, masterSha, REGION_REPO, function(commitSha) {
                console.log("NEW COMMIT: " + commitSha);
                
                update_master(commitSha, REGION_REPO, function(res) {
                    console.log("NEW REF: " + res);
                    callback(res);
                });
            });
        });
    });
}

module.exports.add_odk_json_files = add_odk_json_files;

function new_file(content, pathname) {
    file = {
        path: pathname,
        content: String.fromCharCode.apply(null, new Uint8Array(content)),
        mode: "100644",
        type: "blob"        
    };
    
    return file
}

// return whether or not the current odk json file exists
function odk_json_exists(filename, callback) {
    read_git_release_data(REGION_FS_STORAGE, function(files) {
        res = false
        _.each(files, function(f, i) {
            if (basename(f) + ".json" == filename) {
                res = true
                return
            }
        });

        callback(res)
    });
}

module.exports.odk_json_exists = odk_json_exists;


// Below is an example of how to use the exported files in concert:
/*
function main() {
    async.parallel([

        function(callback) {
            read_usb_data(function(files){
                console.log("Files read on usb: " + files.length);
                callback(null, files)
            })
        },

        function(callback) {
            get_latest_release(REGION_REPO, function(localgit) {            
                read_git_release_data(REGION_FS_STORAGE, function(files) {
                    console.log("Files read from fediquep-data master: " + files.length);
                    callback(null, files)
                })
            })
        },
        
    ], function(err, res) {
        // Interleave results and update each storage engine accordingly
        //
        // First, update the Git Repository with reports stored on the external drive
        update_git_with_usb_data(res[0], res[1], function(){})

        // Next, backfill the usb drive with any differing git content
        update_usb_with_git_data(res[1], res[0], function(){})
    })
}

main()
*/
