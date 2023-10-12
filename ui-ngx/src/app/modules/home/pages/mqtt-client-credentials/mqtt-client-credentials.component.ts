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

import { ChangeDetectorRef, Component, EventEmitter, Inject, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { EntityComponent } from '@home/components/entity/entity.component';
import { EntityTableConfig } from '@home/models/entity/entities-table-config.models';
import {
  clientCredentialsTypeTranslationMap,
  MqttClientCredentials,
  MqttCredentialsType
} from '@shared/models/client-crenetials.model';
import { ClientType, clientTypeTranslationMap } from '@shared/models/client.model';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { appearance } from '@shared/models/constants';
import { isDefinedAndNotNull } from '@core/utils';

@Component({
  selector: 'tb-mqtt-client-credentials',
  templateUrl: './mqtt-client-credentials.component.html',
  styleUrls: ['./mqtt-client-credentials.component.scss'],
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: appearance
    }
  ]
})
export class MqttClientCredentialsComponent extends EntityComponent<MqttClientCredentials> {

  @Output()
  changePasswordCloseDialog = new EventEmitter<MqttClientCredentials>();

  credentialsType = MqttCredentialsType;
  credentialsTypes = Object.values(MqttCredentialsType);
  credentialsTypeTranslationMap = clientCredentialsTypeTranslationMap;
  clientTypes = Object.values(ClientType);

  ClientType = ClientType;
  clientTypeTranslationMap = clientTypeTranslationMap;

  constructor(protected store: Store<AppState>,
              @Inject('entity') protected entityValue: MqttClientCredentials,
              @Inject('entitiesTableConfig') protected entitiesTableConfigValue: EntityTableConfig<MqttClientCredentials>,
              public fb: UntypedFormBuilder,
              protected cd: ChangeDetectorRef) {
    super(store, fb, entityValue, entitiesTableConfigValue, cd);
  }

  hideDelete() {
    if (this.entitiesTableConfig) {
      return !this.entitiesTableConfig.deleteEnabled(this.entity);
    } else {
      return false;
    }
  }

  buildForm(entity: MqttClientCredentials): UntypedFormGroup {
    const form = this.fb.group(
      {
        name: [entity ? entity.name : null, [Validators.required]],
        clientType: [entity ? entity.clientType : null, [Validators.required]],
        credentialsType: [entity ? entity.credentialsType : null, [Validators.required]],
        credentialsValue: [entity ? entity.credentialsValue : null, []]
      }
    );
    form.patchValue({
      clientType: ClientType.DEVICE,
      credentialsType: MqttCredentialsType.MQTT_BASIC
    });
    form.get('credentialsType').valueChanges.subscribe(() => {
      form.patchValue({credentialsValue: null});
    });
    if (isDefinedAndNotNull(this.entitiesTableConfigValue.demoData)) {
      for (const [key, value] of Object.entries(this.entitiesTableConfigValue.demoData)) {
        form.patchValue({
          [key]: value
        });
      }
    }
    return form;
  }

  updateForm(entity: MqttClientCredentials) {
    this.entityForm.patchValue({name: entity.name});
    this.entityForm.patchValue({credentialsType: entity.credentialsType});
    this.entityForm.patchValue({credentialsValue: entity.credentialsValue});
    this.entityForm.patchValue({clientType: entity.clientType});
  }

  onChangePasswordCloseDialog($event: MqttClientCredentials) {
    this.updateForm($event);
  }
}
