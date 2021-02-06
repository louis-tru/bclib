######################################################
D_PORT      ?= 9221
PROJ        ?= bclib
MAIN        ?= index.js
COPYS       ?= .cfg*.js
DEPS        ?= deps deps/bclib/deps
######################################################
NODE       ?= node
UNAME      ?= $(shell uname)
BRANCH      = $(shell git branch|grep '*'|cut -d ' ' -f 2)
TARGET     ?= dev stg prod
TARGETS     = $(foreach i,$(TARGET),$(i) $(i)-brk)
T_TARGETS   = $(foreach i,$(TARGET),t_$(i) t_$(i)-brk)
J_TARGETS   = $(foreach i,$(TARGET),j_$(i) j_$(i)-brk)
R_TARGETS   = $(foreach i,$(TARGET),r_$(i) r_$(i)-brk)
R_DIR      ?= ~/hc
CWD        ?= $(shell pwd)
OUT        ?= out/$(PROJ)
ENV        ?= dev
COPYS      += package.json Makefile LICENSE README.md deps/bclib/tools deps/bclib/build.mk
supervisor= $(shell node -e "console.log(path.resolve(require.resolve('supervisor'), '../../../.bin/supervisor'))")
######################################################

ifneq ($(USER),root)
	SUDO = "sudo"
endif

IP ?=127.0.0.1

cfg = \
if [ -f .config.js ]; then \
	cat .config.js > config.js; \
elif [ -f .cfg_$(1).js ]; then \
	cat .cfg_$(1).js > config.js; \
fi

CP = \
	if [ -f $(1) ]; then \
		cp $(1) $(2); \
		if [ "$(notdir $(2))" == "somes" ]; then \
			cp $(dir $(1))*.types $(2); \
		fi; \
	fi;

r_exec = cd $(OUT); \
	$(NODE) ./deps/bclib/tools/sync_watch_ser.js -u $1 -h $2 $(if $(SYNC),,-d 20000) -t \
		'$(R_DIR)/$(PROJ)/$(OUT)' -i config.js -i .config.js -i var -i node_modules & \
	ssh $1@$2 'cd $(R_DIR)/$(PROJ)/$(OUT); make j$3'

.PHONY: all build build-install kill init $(TARGETS) $(T_TARGETS) $(R_TARGETS) $(J_TARGETS)

.SECONDEXPANSION:

all: build

build:
	mkdir -p $(OUT)
	cd out && ln -sf $(PROJ) dist
	$(call cfg,$(ENV))
	$(foreach i, $(COPYS), mkdir -p $(OUT)/$(dir $(i)); cp -rf $(i) $(OUT)/$(dir $(i));)
	find out -name '*.ts'| xargs rm -rf
	tsc
	$(foreach i, $(DEPS), $(foreach j, $(shell ls $(i)), $(call CP,$(i)/$(j)/package.json,$(OUT)/$(i)/$(j)) ))
	rm -rf $(OUT)/config.js
	cd out && tar -c --exclude $(PROJ)/node_modules -z -f $(PROJ).tgz $(PROJ)

build-install: build
	$(MAKE) -C $(OUT) install
	cd out && tar cfz $(PROJ)-all.tgz $(PROJ)

kill:
	@-$(SUDO) systemctl stop $(PROJ)
	@-cat var/pid|xargs $(SUDO) kill
	@-pgrep -f "$(MAIN)"|xargs kill
	@-pgrep -f "sync_watch_ser.js"|xargs kill

# local debugger start
$(TARGETS):
	@if [ -f $(MAIN) ]; then $(MAKE) j_$@; else $(MAKE) t_$@; fi

# tsc -w
$(T_TARGETS): kill
	ENV=$(subst -brk,,$(subst t_,,$@)) $(MAKE) build
	@-pgrep -f "tsc -w" | xargs kill
	@tsc -w > out/output.out 2>&1 &
	@if [ -f .config.js ]; then cp .config.js $(OUT); fi
	$(MAKE) -C $(OUT) j_$(subst t_,,$@)

# js debugger
$(J_TARGETS): kill
	@$(call cfg,$(subst -brk,,$(subst j_,,$@)))
	@if [ ! -d node_modules ]; then npm i --unsafe-perm; fi
	@$(supervisor) -w . -i public -i node_modules -- --inspect$(findstring -brk,$@)=0.0.0.0:$(D_PORT) $(MAIN)

# remote debugger
$(R_TARGETS): kill
	@ENV=$(subst -brk,,$(subst r_,,$@)) $(MAKE) build
	@-pgrep -f "tsc -w" | xargs kill
	@tsc -w > out/output.out 2>&1 &
	@$(call r_exec,root,$(IP),$(shell echo $@|cut -b 2-10))

init:
	git submodule update --init --recursive