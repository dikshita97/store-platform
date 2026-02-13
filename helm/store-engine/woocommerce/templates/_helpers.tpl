{{/* vim: set filetype=mustache: */}}
{{/* Store Instance Helm Chart - Helper Templates */}}

{{/* Expand the name of the chart. */}}
{{- define "store-instance.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Create a default fully qualified app name. */}}
{{- define "store-instance.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/* Create chart name and version */}}
{{- define "store-instance.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels */}}
{{- define "store-instance.labels" -}}
helm.sh/chart: {{ include "store-instance.chart" . }}
{{ include "store-instance.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: store-platform
store.platform.io/id: {{ .Values.store.id | quote }}
store.platform.io/engine: {{ .Values.store.engine | quote }}
{{- end -}}

{{/* Selector labels */}}
{{- define "store-instance.selectorLabels" -}}
app.kubernetes.io/name: {{ include "store-instance.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* WordPress labels */}}
{{- define "store-instance.wordpress.labels" -}}
{{ include "store-instance.labels" . }}
app.kubernetes.io/component: wordpress
{{- end -}}

{{/* MySQL labels */}}
{{- define "store-instance.mysql.labels" -}}
{{ include "store-instance.labels" . }}
app.kubernetes.io/component: mysql
{{- end -}}

{{/* WordPress fullname */}}
{{- define "store-instance.wordpress.fullname" -}}
{{ include "store-instance.fullname" . }}-wordpress
{{- end -}}

{{/* MySQL fullname */}}
{{- define "store-instance.mysql.fullname" -}}
{{ include "store-instance.fullname" . }}-mysql
{{- end -}}

{{/* Storage class */}}
{{- define "store-instance.storageClass" -}}
{{- if .Values.global.storageClass -}}
{{- .Values.global.storageClass -}}
{{- else -}}
{{- "standard" -}}
{{- end -}}
{{- end -}}

{{/* MySQL root password */}}
{{- define "store-instance.mysql.rootPassword" -}}
{{- if .Values.database.rootPassword -}}
{{- .Values.database.rootPassword -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end -}}

{{/* MySQL password */}}
{{- define "store-instance.mysql.password" -}}
{{- if .Values.database.password -}}
{{- .Values.database.password -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end -}}

{{/* WordPress admin password */}}
{{- define "store-instance.wordpress.adminPassword" -}}
{{- if .Values.wordpress.admin.password -}}
{{- .Values.wordpress.admin.password -}}
{{- else -}}
{{- randAlphaNum 16 -}}
{{- end -}}
{{- end -}}

{{/* WordPress salts */}}
{{- define "store-instance.wordpress.authKey" -}}
{{- if .Values.wordpress.salts.authKey -}}
{{- .Values.wordpress.salts.authKey -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{- define "store-instance.wordpress.secureAuthKey" -}}
{{- if .Values.wordpress.salts.secureAuthKey -}}
{{- .Values.wordpress.salts.secureAuthKey -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{- define "store-instance.wordpress.loggedInKey" -}}
{{- if .Values.wordpress.salts.loggedInKey -}}
{{- .Values.wordpress.salts.loggedInKey -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{- define "store-instance.wordpress.nonceKey" -}}
{{- if .Values.wordpress.salts.nonceKey -}}
{{- .Values.wordpress.salts.nonceKey -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{- define "store-instance.wordpress.authSalt" -}}
{{- if .Values.wordpress.salts.authSalt -}}
{{- .Values.wordpress.salts.authSalt -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{- define "store-instance.wordpress.secureAuthSalt" -}}
{{- if .Values.wordpress.salts.secureAuthSalt -}}
{{- .Values.wordpress.salts.secureAuthSalt -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{- define "store-instance.wordpress.loggedInSalt" -}}
{{- if .Values.wordpress.salts.loggedInSalt -}}
{{- .Values.wordpress.salts.loggedInSalt -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{- define "store-instance.wordpress.nonceSalt" -}}
{{- if .Values.wordpress.salts.nonceSalt -}}
{{- .Values.wordpress.salts.nonceSalt -}}
{{- else -}}
{{- randAlphaNum 64 -}}
{{- end -}}
{{- end -}}

{{/* Ingress host */}}
{{- define "store-instance.ingress.host" -}}
{{- if .Values.wordpress.site.url -}}
{{- .Values.wordpress.site.url -}}
{{- else -}}
{{- printf "%s-%s.%s" .Values.store.name .Values.store.id .Values.global.baseDomain -}}
{{- end -}}
{{- end -}}

{{/* Resources for plan */}}
{{- define "store-instance.resources" -}}
{{- $plan := .Values.store.plan -}}
{{- if eq $plan "basic" -}}
{{- toYaml .Values.wordpress.resources.basic -}}
{{- else if eq $plan "standard" -}}
{{- toYaml .Values.wordpress.resources.standard -}}
{{- else if eq $plan "premium" -}}
{{- toYaml .Values.wordpress.resources.premium -}}
{{- else -}}
{{- toYaml .Values.wordpress.resources.basic -}}
{{- end -}}
{{- end -}}

{{/* Database resources for plan */}}
{{- define "store-instance.database.resources" -}}
{{- $plan := .Values.store.plan -}}
{{- if eq $plan "basic" -}}
{{- toYaml .Values.database.resources.basic -}}
{{- else if eq $plan "standard" -}}
{{- toYaml .Values.database.resources.standard -}}
{{- else if eq $plan "premium" -}}
{{- toYaml .Values.database.resources.premium -}}
{{- else -}}
{{- toYaml .Values.database.resources.basic -}}
{{- end -}}
{{- end -}}
