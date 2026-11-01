#!/bin/sh
set -eu
# No accept-data-loss flag: incompatible schema changes must be reviewed by the operator.
./node_modules/.bin/prisma db push --skip-generate --schema prisma/schema.prisma
exec "$@"
