# App Installer

This is just barebones, please find your own packages to include into the .txt files or dont, its up to you.

#########

On a fresh Windows 10 or Windows 11, you need to do the following steps:

1. Open Powershell as Admin

2. In the Powershell window, run the following command "Set-ExecutionPolicy Bypass". This will enable the script to run

3. Download the script and the apps.txt file into a folder and navigate to the folder in Powershell

4. Run the script by typing ".\devinstaller.ps1" without the ".

5. The script will first check if Chocolatey is already installed, if its not installed, it will run the install script to install Chocolatey

6. Next the script will prompt you with a choice, just install everything or let me decide for each app in the list. Press 'E' to just install everything with no user input or press 'D' to decide for each.

7. If you've selected to decide app, you'll need to type Y/N for each app in the apps.txt list.

8. If you've selected to just install everything, just leave the script until its done.

9. Done.