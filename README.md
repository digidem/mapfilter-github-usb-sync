# odk-usb-github-sync

The purpose of this node module is to provide the necessary logic to upload the `.json` files used by Digital Democracy's MapFilter project to a github repository.  It also provides the ability to synchronize connected USB devices with the most recent version of github repository, effectively enabling Monitors for Fediquep and other environmental advocacy organizations to have up-to-date offline storage for mobile data collection.

## usage

`odk-usb-github-sync` provides the following set of API methods:

  - `read_usb_data(callback)` : Reads the connected USB device and calls the passed in callback with a list of ODK JSON files.
  - `read_git_release_data(dir, callback)` : Reads the latest release data from the passed in directory where the latest git master ref was unzipped.  Calls the passed in callback with a list of ODK JSON files.
  - `update_git_with_usb_data(usb_list, git_list, callback)` : Updates the git repository by finding all local diffs between the most recent version of master and files that exist on the USB device.  Commits all of the files into a single tree and changes the master ref to point to the new commit.  Calls the passed in callback once completed.
  - `update_usb_with_git_data(usb_list, git_list, callback)` : Currently unimplemented, as it was intended to be the final piece of work that would tie the whole integration together.  Intended to Backfill the usb device with the most recent state of the world held by the github repository.  Calls the passed in callback once done.
  - `get_latest_release(repo, callback)` : Downloads the HEAD ref of the passed in repo's master branch and unzips it to the local filesystem at `REGION_FS_STORAGE`.  Calls the passed in callback once completed.  If running in `OFFLINE_MODE`, it will simply call the passed in callback.
  - `add_odk_json_files(files, callback)` : Creates a Tree object on the github API for the passed in files, creates a commit, then changes the ref to Master to point to the new commit.  Calls the passed in callback when complete.
  - `odk_json_exists(filename, callback)` : Calls the callback with a boolean value which is equivalent to whether or not the passed in filename exists on the local filesystem.

