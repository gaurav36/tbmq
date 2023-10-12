///
/// Copyright © 2016-2023 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import {
  CellActionDescriptor,
  checkBoxCell,
  clientTypeCell,
  connectedStateCell,
  DateEntityTableColumn,
  EntityTableColumn,
  EntityTableConfig,
  GroupActionDescriptor
} from '@home/models/entity/entities-table-config.models';
import { TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TimePageLink } from '@shared/models/page/page-link';
import { forkJoin, Observable } from 'rxjs';
import { PageData } from '@shared/models/page/page-data';
import { MqttClientSessionService } from '@core/http/mqtt-client-session.service';
import { SessionsDetailsDialogComponent, SessionsDetailsDialogData } from '@home/pages/sessions/sessions-details-dialog.component';
import {
  ConnectionState,
  connectionStateColor,
  connectionStateTranslationMap,
  DetailedClientSessionInfo,
  initialSessionFilterConfig,
  SessionFilterConfig,
  SessionQuery
} from '@shared/models/session.model';
import { clientTypeColor, clientTypeIcon, clientTypeTranslationMap } from '@shared/models/client.model';
import { Direction } from '@shared/models/page/sort-order';
import { DialogService } from '@core/services/dialog.service';
import { SessionTableHeaderComponent } from '@home/pages/sessions/session-table-header.component';
import { forAllTimeInterval } from '@shared/models/time/time.models';
import { ActivatedRoute, Router } from '@angular/router';
import { deepClone } from '@core/utils';

export class SessionsTableConfig extends EntityTableConfig<DetailedClientSessionInfo, TimePageLink> {

  sessionFilterConfig: SessionFilterConfig = initialSessionFilterConfig;

  constructor(private mqttClientSessionService: MqttClientSessionService,
              private translate: TranslateService,
              private datePipe: DatePipe,
              private dialog: MatDialog,
              private dialogService: DialogService,
              public entityId: string = null,
              private route: ActivatedRoute,
              private router: Router) {
    super();
    this.loadDataOnInit = true;
    this.detailsPanelEnabled = false;
    this.searchEnabled = true;
    this.addEnabled = false;
    this.entitiesDeleteEnabled = false;
    this.tableTitle = this.translate.instant('mqtt-client-session.type-sessions');
    this.entityTranslations = {
      noEntities: 'mqtt-client-session.no-session-text',
      search: 'mqtt-client-session.search'
    };
    this.defaultSortOrder = {property: 'connectedAt', direction: Direction.DESC};
    this.groupActionDescriptors = this.configureGroupActions();
    this.cellActionDescriptors = this.configureCellActions();

    this.headerComponent = SessionTableHeaderComponent;
    this.useTimePageLink = true;
    this.forAllTimeEnabled = true;
    this.selectionEnabled = true;
    this.defaultTimewindowInterval = forAllTimeInterval();

    this.entitiesFetchFunction = pageLink => this.fetchSessions(pageLink);
    this.handleRowClick = ($event, entity) => this.showSessionDetails($event, entity);

    this.columns.push(
      new DateEntityTableColumn<DetailedClientSessionInfo>('connectedAt', 'mqtt-client-session.connected-at', this.datePipe, '160px'),
      new EntityTableColumn<DetailedClientSessionInfo>('connectionState', 'mqtt-client-session.connected-status', '10%',
        (entity) => connectedStateCell(this.translate.instant(connectionStateTranslationMap.get(entity.connectionState)), connectionStateColor.get(entity.connectionState))),
      new EntityTableColumn<DetailedClientSessionInfo>('clientType', 'mqtt-client.client-type', '10%',
        (entity) => {
        const clientType = entity.clientType;
        const clientTypeTranslation = this.translate.instant(clientTypeTranslationMap.get(clientType));
        const icon = clientTypeIcon.get(clientType);
        const color = clientTypeColor.get(clientType);
        return clientTypeCell(clientTypeTranslation, icon, color);
      }),
      new EntityTableColumn<DetailedClientSessionInfo>('clientId', 'mqtt-client.client-id', '25%'),
      new EntityTableColumn<DetailedClientSessionInfo>('clientIpAdr', 'mqtt-client-session.client-ip', '15%'),
      new EntityTableColumn<DetailedClientSessionInfo>('subscriptionsCount', 'mqtt-client-session.subscriptions-count', '10%'),
      new EntityTableColumn<DetailedClientSessionInfo>('nodeId', 'mqtt-client-session.node-id', '10%'),
      new DateEntityTableColumn<DetailedClientSessionInfo>('disconnectedAt', 'mqtt-client-session.disconnected-at', this.datePipe, '160px'),
      new EntityTableColumn<DetailedClientSessionInfo>('cleanStart', 'mqtt-client-session.clean-start', '60px',
        entity => checkBoxCell(entity?.cleanStart))
    );
  }

  private fetchSessions(pageLink: TimePageLink): Observable<PageData<DetailedClientSessionInfo>> {
    const routerQueryParams: SessionFilterConfig = this.route.snapshot.queryParams;
    if (routerQueryParams) {
      const queryParams = deepClone(routerQueryParams);
      let replaceUrl = false;
      if (routerQueryParams?.connectedStatusList) {
        this.sessionFilterConfig.connectedStatusList = routerQueryParams?.connectedStatusList;
        delete queryParams.connectedStatusList;
        replaceUrl = true;
      }
      if (replaceUrl) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams,
          queryParamsHandling: '',
          replaceUrl: true
        });
      }
    }
    const sessionFilter = this.resolveSessionFilter(this.sessionFilterConfig);
    const query = new SessionQuery(pageLink, sessionFilter);
    return this.mqttClientSessionService.getShortClientSessionInfosV2(query);
  }

  private showSessionDetails($event: Event, entity: DetailedClientSessionInfo) {
    if ($event) {
      $event.stopPropagation();
    }
    this.mqttClientSessionService.getDetailedClientSessionInfo(entity.clientId).subscribe(
      session => {
        this.dialog.open<SessionsDetailsDialogComponent, SessionsDetailsDialogData>(SessionsDetailsDialogComponent, {
          disableClose: true,
          panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
          data: {
            session
          }
        }).afterClosed()
          .subscribe(() => this.updateTable());
      }
    );
    return false;
  }

  configureGroupActions(): Array<GroupActionDescriptor<DetailedClientSessionInfo>> {
    const actions: Array<GroupActionDescriptor<DetailedClientSessionInfo>> = [];
    actions.push(
      {
        name: this.translate.instant('mqtt-client-session.disconnect-client-sessions'),
        icon: 'mdi:link-off',
        isMdiIcon: true,
        isEnabled: true,
        onAction: ($event, entities) =>
          this.disconnectClientSessions($event, entities.filter(entity => entity.connectionState === ConnectionState.CONNECTED))
      },
      {
        name: this.translate.instant('mqtt-client-session.remove-sessions'),
        icon: 'mdi:trash-can-outline',
        isMdiIcon: true,
        isEnabled: true,
        onAction: ($event, entities) =>
          this.removeClientSessions($event, entities.filter(entity => entity.connectionState === ConnectionState.DISCONNECTED))
      }
    );
    return actions;
  }

  configureCellActions(): Array<CellActionDescriptor<DetailedClientSessionInfo>> {
    const actions: Array<CellActionDescriptor<DetailedClientSessionInfo>> = [];
    actions.push(
      {
        name: this.translate.instant('mqtt-client-session.disconnect-client-sessions'),
        mdiIcon: 'mdi:link-off',
        isEnabled: (entity) => (entity.connectionState === ConnectionState.CONNECTED),
        onAction: ($event, entity) => this.disconnectClientSession($event, entity)
      },
      {
        name: this.translate.instant('mqtt-client-session.remove-session'),
        mdiIcon: 'mdi:trash-can-outline',
        isEnabled: (entity) => (entity.connectionState === ConnectionState.DISCONNECTED),
        onAction: ($event, entity) => this.removeClientSession($event, entity)
      }
    );
    return actions;
  }

  disconnectClientSessions($event: Event, sessions: Array<DetailedClientSessionInfo>) {
    if ($event) {
      $event.stopPropagation();
    }
    this.dialogService.confirm(
      this.translate.instant('mqtt-client-session.disconnect-client-sessions-title', {count: sessions.length}),
      this.translate.instant('mqtt-client-session.disconnect-client-sessions-text'),
      this.translate.instant('action.no'),
      this.translate.instant('action.yes'),
      true
    ).subscribe((res) => {
        if (res) {
          const tasks: Observable<any>[] = [];
          sessions.forEach(
            (session) => {
              tasks.push(this.mqttClientSessionService.disconnectClientSession(session.clientId, session.sessionId));
            }
          );
          forkJoin(tasks).subscribe(() => this.updateTable()); //TODO deaflynx
        }
      }
    );
  }

  disconnectClientSession($event: Event, session: DetailedClientSessionInfo) {
    if ($event) {
      $event.stopPropagation();
    }
    const title = this.translate.instant('mqtt-client-session.disconnect-client-session-title', {clientId: session.clientId});
    const content = this.translate.instant('mqtt-client-session.disconnect-client-session-text');
    this.dialogService.confirm(
      title,
      content,
      this.translate.instant('action.no'),
      this.translate.instant('action.yes'),
      true
    ).subscribe((res) => {
        if (res) {
          this.mqttClientSessionService.disconnectClientSession(session.clientId, session.sessionId).subscribe(() => this.updateTable());
        }
      }
    );
  }

  removeClientSession($event: Event, session: DetailedClientSessionInfo) {
    if ($event) {
      $event.stopPropagation();
    }
    const title = this.translate.instant('mqtt-client-session.remove-session-title', {clientId: session.clientId});
    const content = this.translate.instant('mqtt-client-session.remove-session-text');
    this.dialogService.confirm(
      title,
      content,
      this.translate.instant('action.no'),
      this.translate.instant('action.yes'),
      true
    ).subscribe((res) => {
        if (res) {
          this.mqttClientSessionService.removeClientSession(session.clientId, session.sessionId).subscribe(() => this.updateTable());
        }
      }
    );
  }

  removeClientSessions($event: Event, sessions: Array<DetailedClientSessionInfo>) {
    if ($event) {
      $event.stopPropagation();
    }
    this.dialogService.confirm(
      this.translate.instant('mqtt-client-session.remove-sessions-title', {count: sessions.length}),
      this.translate.instant('mqtt-client-session.remove-sessions-text'),
      this.translate.instant('action.no'),
      this.translate.instant('action.yes'),
      true
    ).subscribe((res) => {
        if (res) {
          const tasks: Observable<any>[] = [];
          sessions.forEach(
            (session) => {
              tasks.push(this.mqttClientSessionService.removeClientSession(session.clientId, session.sessionId));
            }
          );
          forkJoin(tasks).subscribe(() => this.updateTable());
        }
      }
    );
  }

  private updateTable() {
    this.getTable().updateData();
  }

  private resolveSessionFilter(sessionFilterConfig?: SessionFilterConfig): SessionFilterConfig {
    const sessionFilter: SessionFilterConfig = {};
    if (sessionFilterConfig) {
      sessionFilter.clientId = sessionFilterConfig.clientId;
      sessionFilter.connectedStatusList = sessionFilterConfig.connectedStatusList;
      sessionFilter.clientTypeList = sessionFilterConfig.clientTypeList;
      sessionFilter.cleanStartList = sessionFilterConfig.cleanStartList;
      sessionFilter.nodeIdList = sessionFilterConfig.nodeIdList;
      sessionFilter.subscriptions = sessionFilterConfig.subscriptions;
    }
    return sessionFilter;
  }
}
