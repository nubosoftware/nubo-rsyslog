FROM node:16-alpine3.15
ARG BUILD_VER=3.2
ARG TARGET_DIR=/opt/nubo-rsyslog

# mark this as docker installation
RUN mkdir -p /etc/.nubo/ && \
    touch  /etc/.nubo/.docker

RUN mkdir -p ${TARGET_DIR}/log
RUN chown -R node:node ${TARGET_DIR}

# Run with user nubo
USER node

# install the node project

COPY src ${TARGET_DIR}/src
COPY package.json ${TARGET_DIR}
WORKDIR ${TARGET_DIR}
RUN npm i
RUN echo "VERSION: ${BUILD_VER}" > version.txt

# configure
ADD bin /usr/bin

# Create a new user nubo
# ARG UID=1000
# ARG GID=1000
# RUN groupadd --gid $GID nubo
# RUN useradd --system --create-home --shell /usr/sbin/nologin --uid $UID --gid $GID nubo



# Docker config
VOLUME ["${TARGET_DIR}/log"]
EXPOSE 5514
ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]