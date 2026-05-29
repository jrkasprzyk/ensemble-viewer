# User Notes

## Making it easier to create CSV files from RDF

The main list items came from user feedback, and the sub-items are comments from me, the developer of this tool

1. Generalize the process to generate the necessary CSV files from RDF. Ideally this would be done via a GUI, but in the meantime, a general script that is either easy to edit directly at the top of the script or for which details can be entered as arguments on the command line. 
	1. While testing, this was implemented by simplifying the .bat file and making it clear what parameters needed to change.
	2. However there is still the issue that the user needs Python installed, and they would also need to clone the repo in order to do the conversion. This is fine for developers, but not good for general users
2. Add the ability to save/load a configuration (all the information from the left panel). 
	1. This would enable a user to use preconfigured plots, and we could set things up in advance (such as preferred options for plotting Pool Elevation slots from RiverWare)
	2. In typical RiverWare applications, they create GUI to create configurations like this, but the configuration itself should be saved in XML and the schema should be publicly documented
3. Auto-generate the y axis label from the slot name and units. 
	1. This would require including the slot name and units in the CSV file somehow.
	2. Perhaps a look-up table could be added in the codebase, with nicely formatted labels for all the different types of RiverWare series slots
4. Show the Year labels without a decimal point (or more generally allow control over the precision of data used for labels).
5. Add the ability to set the line thickness and opacity directly by typing in a value, not only via slider.
	1. In a recent update, the slider was improved, but I agree that being able to enter the numbers directly would be nice
	2. We're using nonlinear scaling functions, and so it would be great to give the user more control over just specifying values rather than fiddling with the different tuning parameters that are used to calculate the opacity and thickness.
	3. This would be an *additional* feature, it would not replace the customizability we already have
6. It was not clear what the “Show mean + p10-p90 bands per group” option did. In my plots, it just seemed to make all the curves a bit lighter.
	1. It's possible that this is a bug. We haven't messed with the 10-90 features for a while, so it could be that they are not longer even working...

>Continue the 'create-implementation-plan' format below:
# Introduction