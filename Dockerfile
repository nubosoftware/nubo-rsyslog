FROM ubuntu:20.04
RUN apt-get -y update
# install linux packages
RUN apt install -y \
    curl \
    vim \
    iputils-ping \
    telnet \
    dnsutils \
    net-tools


# install nodejs
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt install -y nodejs

# mark this as docker installation
RUN mkdir -p /etc/.nubo/ && \
    touch  /etc/.nubo/.docker

# install the node project
RUN mkdir -p /opt/nubo-rsyslog/log
COPY src /opt/nubo-rsyslog/src
COPY package.json /opt/nubo-rsyslog
RUN cd /opt/nubo-rsyslog \
    && npm i


# configure
ADD bin /usr/bin

# Create a new user nubo
ARG UID=1000
ARG GID=1000
RUN groupadd --gid $GID nubo
RUN useradd --system --create-home --shell /usr/sbin/nologin --uid $UID --gid $GID nubo

RUN chown -R nubo:nubo /opt/nubo-rsyslog

# Run with user nubo
# USER nubo

# Docker config
VOLUME ["/opt/nubo-rsyslog/log"]
WORKDIR /opt/nubo-rsyslog
EXPOSE 5514
ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]