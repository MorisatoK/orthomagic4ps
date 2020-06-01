# orthomagic4ps
Magic Photoshop scripts to make editing orthophotos easier. Intended as a supplement to Ortho4XP, as such knowing your way around it is required.

## Install
Download the raw files from the `dist` directory or clone/download the whole repository and copy the files from the `dist` directory to a place of your liking and you can access them from Photoshop.

## Usage
See detailed steps below for each script. In general execute the scripts by going to `File » Script » Browse...` and select the according script from wherever you saved it.

## Recommendation
Placing hundreds of 4096x4096px large tiles on an enourmous canvas is a very demanding task and requires a lot of RAM and hard disk space. For example a PSB file for only ZL16 will have dimensions of aprox. 53.248x77.824px and a whopping ~24Gb of file size. When working with these files Photoshop will also eat the hard disk space of your working volume(s) depending on how much RAM you have. Some recommendations to somewhat remedy that:
1. Reduce the number of stored history objects in the options (maybe 2-3)
2. Place the orthophotos as linked smart objects - drag and drop while holding down the `ALT`/`OPTION` key - so they are not stored inside the Photoshop file itself.
3. Enable option to skip transformation on placing smart objects - otherwise you have to confirm every placement.
4. Enable option to always create smart objects on placing

## Scripts
### Import Magic
This script will place the orthophotos next to each other on the canvas.

#### Usage
1. Create a new document with the dimensions `4096x4096` and transparent background (without a background layer)
2. Save the empty document and name it like the directory where Ortho4XP stores the orthophotos - and suffix it with the base zoom level of your tile, f.e. `+52+013_16`.
3. Place the orthophotos from Ortho4XP on it (see recommendations above)
4. Wait
5. Run the script (see above)
6. Wait...
7. Just a little bit...
8. The magic is happening right now... I promise!
9. It will be finished soon^tm...
10. Profit. Now would be a good time to save the document.
11. Repeat steps 6, 7 and 9.
12. If you have configured larger zoom levels, you might notice missing pieces - because Ortho4XP didn't download them at the base zoom level.
13. For adding those, basically repeat steps 3 to 9 for each zoom level you want to add. Just make sure the newly placed orthophotos are above those with lower zoom level. Alternatively create a new document and start with step 1 again, but with adjusted zoom level.

#### Known issues
* Mixing zoom levels in one document sometimes results in the higher zoom level orthophotos being shifted by one ore two "units" on the x and y axis. Manual adjustment is needed here. For the time being it is recommended to not mix zoom levels.

### Export Magic
Would be nice to have ... but I could not come up with some magically automated way yet - especially with mixed zoom levels in one document.