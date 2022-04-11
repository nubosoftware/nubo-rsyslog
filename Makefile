default: usage

usage:
	@echo "valid tasks: docker, version"

BASE_TAG := nubo_release_3.2
BASE_VERSION := 3.2


define get_project_version
$(eval $1_version=$(BASE_VERSION))
$(eval $1_buildid=$(shell git log $(BASE_TAG)..HEAD --oneline | wc -l))
$(eval $1_buildid=$(shell echo $($1_buildid)+1 | bc))
endef

$(eval $(call get_project_version,project))

docker:
	docker build --build-arg BUILD_VER=$(project_version)-$(project_buildid) --no-cache --pull -f ./Dockerfile -t nubo-rsyslog:$(project_version)-$(project_buildid) .

push-nubo: docker
	docker tag nubo-rsyslog:$(project_version)-$(project_buildid) docker.nubosoftware.com:5000/nubo/nubo-rsyslog:$(project_version)-$(project_buildid)
	docker push docker.nubosoftware.com:5000/nubo/nubo-rsyslog:$(project_version)-$(project_buildid)
	docker tag nubo-rsyslog:$(project_version)-$(project_buildid) docker.nubosoftware.com:5000/nubo/nubo-rsyslog:$(project_version)
	docker push docker.nubosoftware.com:5000/nubo/nubo-rsyslog:$(project_version)

push-nubo-latest: push-nubo
	docker tag nubo-rsyslog:$(project_version)-$(project_buildid) docker.nubosoftware.com:5000/nubo/nubo-rsyslog
	docker push docker.nubosoftware.com:5000/nubo/nubo-rsyslog

push-hub: docker
	docker tag nubo-rsyslog:$(project_version)-$(project_buildid) nubosoftware/nubo-rsyslog:$(project_version)-$(project_buildid)
	docker push nubosoftware/nubo-rsyslog:$(project_version)-$(project_buildid)
	docker tag nubo-rsyslog:$(project_version)-$(project_buildid) nubosoftware/nubo-rsyslog:$(project_version)
	docker push nubosoftware/nubo-rsyslog:$(project_version)

push-hub-latest: push-nubo
	docker tag nubo-rsyslog:$(project_version)-$(project_buildid) nubosoftware/nubo-rsyslog
	docker push nubosoftware/nubo-rsyslog


version:
	@echo "project version $(project_version)-$(project_buildid)"