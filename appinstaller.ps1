## Start up fluff

Write-host @"
    DevInstaller`n`n
    Install script for setting up a Dev Environment
    Installing packages from Chocolatey and configuring everything you need`n
"@

Write-host -ForegroundColor "Yellow" "`n    Checking if Chocolatey is installed on the computer...`n"

If (Test-Path -Path "$env:ProgramData\Chocolatey") {
    Write-host -ForegroundColor "Green" "      Chocolatey is installed, moving on to packages`n"
}
else {
    Write-host  "     Chocolatey is not installed, starting installscript for Chocolatey`n"
    Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
}

##
## Startup fluff over
##

######################################################################
#                                                                    #
#   Prompt the user to select a role for the user                    #
#                                                                    #
######################################################################

$title = "Which role do you want to install for?"
$message = ""

$developer = New-Object System.Management.Automation.Host.ChoiceDescription "&Developer", `
    "Setup this machine for a Developer"

$nontechnicalstaff = New-Object System.Management.Automation.Host.ChoiceDescription "&Non-technical staff", `
    "Setup this machine for a non-technical staff member"

$supportdelivery = New-Object System.Management.Automation.Host.ChoiceDescription "&Support & Delivery", `
    "Setup this machine for a Support '&' Delivery Team"

$options = [System.Management.Automation.Host.ChoiceDescription[]]($developer, $nontechnicalstaff, $supportdelivery)
$AppsToInstall = $host.ui.PromptForChoice($title, $message, $options, 0)


if ($AppsToInstall -eq 0) {
    Write-host -ForegroundColor "Cyan" "    Developer Install selected`n"
    $installFrom = "$PSSCriptRoot\devs.txt"
}
if ($AppsToInstall -eq 1) {
    Write-host -ForegroundColor "Cyan" "    Non-Technical Staff Install selected`n"
    $installFrom = "$PSSCriptRoot\nontech.txt"
}
if ($AppsToInstall -eq 2) {
    Write-host -ForegroundColor "Cyan" "    Support & Delivery Install selected`n"
    $installFrom = "$PSSCriptRoot\support.txt"
}

######################################################################
#                                                                    #
#   Prompt the user for a speedy install or a choice driven install  #
#                                                                    #
######################################################################

$title = "Do you want to just install everything or do you want to select what to install?"
$message = ""

$yes = New-Object System.Management.Automation.Host.ChoiceDescription "&Everything", `
    "Install everything"

$maybe = New-Object System.Management.Automation.Host.ChoiceDescription "&Decide for each", `
    "Decide for each item if you want to install it or not.."

$no = New-Object System.Management.Automation.Host.ChoiceDescription "&Cancel", `
    "Cancel the process"

$options = [System.Management.Automation.Host.ChoiceDescription[]]($yes, $maybe, $no)
$howToProcess = $host.ui.PromptForChoice($title, $message, $options, 0)


#######################
#                     #
#  Automatic Process  #
#                     #
#######################

if ($howToProcess -eq 0) {

    # User responded "Install everything"
    Write-host -ForegroundColor "Cyan" "`n------------------------------------------------------------------------------------`n"
    Write-host -ForegroundColor "Cyan" "    Starting installation Process`n"
    Write-host -ForegroundColor "Cyan" "------------------------------------------------------------------------------------`n"

    # Get all the apps from apps.txt file
    $packages = Get-Content "$installFrom"

    # Count how many applications are in the apps.txt file and relay this information to the user.
    $count = Get-Content "$installFrom" | Measure-Object -Line
    Write-host -ForegroundColor "Cyan" "`n    > Application list contains $count applications.`n"

    # Loop through all the apps from apps.txt and install them with Chocolatey.
    foreach ($package in $packages) {
        choco install $package  -y
        Write-host -ForegroundColor "Cyan" "`n------------------------------------------------------------------------------------`n"
        Write-host -ForegroundColor "Cyan" "    Devinstaller Info`n"
        Write-host -ForegroundColor "Cyan" "    Installation of $package has been completed`n"
        Write-host -ForegroundColor "Cyan" "`n------------------------------------------------------------------------------------`n"
    }

    Write-host -ForegroundColor "Cyan" "------------------------------------------------------------------------------------"
    Write-host -ForegroundColor "Cyan" "    Finished installation Process"
    Write-host -ForegroundColor "Cyan" "------------------------------------------------------------------------------------`n"
}

# /Automatic Process Done

########################
#                      #
#    Manual Process    #
#                      #
########################

if ($howToProcess -eq 1) {

    Write-host -ForegroundColor "Yellow" "------------------------------------------------------------------------------------`n"
    Write-host -ForegroundColor "Green" "    Starting installation Process`n"
    Write-host -ForegroundColor "Yellow" "------------------------------------------------------------------------------------"

    # User responded "Decide for each item if you want to install it or not.."

    $packages = get-content "$installFrom"

    foreach ($package in $packages) {
        # PromptForChoice Args
        $Title = " Would you like to install"
        $Prompt = "`n $package`n`n"
        $Choices = [System.Management.Automation.Host.ChoiceDescription[]] @("&Yes, install it", "&No, thank you")
        $Default = 0

        # Prompt for the choice
        $Choice = $host.UI.PromptForChoice($Title, $Prompt, $Choices, $Default)

        # Action based on the choice
        switch ($Choice) {
            0 {
                choco install $package -y
                Write-host -ForegroundColor "Cyan" "`n------------------------------------------------------------------------------------`n"
                Write-host -ForegroundColor "Cyan" "     Devinstaller Info"
                Write-host -ForegroundColor "Cyan" "     Installation of $package has been completed`n"
                Write-host -ForegroundColor "Cyan" "`n------------------------------------------------------------------------------------`n"

            }
            1 {
                Write-host -ForegroundColor "Red" "`n------------------------------------------------------------------------------------`n"
                Write-host -ForegroundColor "Red" "     Devinstaller Info"
                Write-host -ForegroundColor "Red" "     Installation of $package has been skipped by the user`n"
                Write-host -ForegroundColor "Red" "`n------------------------------------------------------------------------------------`n"
            }
        }
    }
}

###################
#                 #
#  Cancel Action  #
#                 #
###################

if ($howToProcess -eq 2) {
    # User responded "Cancel the process"
    Write-host -ForegroundColor "Red" "User aborted the script."
    Exit
}

# /Cancel action done