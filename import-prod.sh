set -e

PROJECT=kobe
USER=lipp
SERVER=lipp.local 
PORT=6602

NOW=$(date +"%Y-%m-%dT%H:%M:%S%z")
mkdir -p .backups/

scp -v $USER@$SERVER:/home/$USER/projects/$PROJECT/database.db ./database.db
cp ./database.db .backups/database-$NOW.db.backup
