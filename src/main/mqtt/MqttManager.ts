import mqtt, { MqttClient } from 'mqtt';
import crypto from 'crypto';

// Room load mapping
const roomLoadMapping: Record<string, string[]> = {
  savage: ['spots', 'mirros', 'sign', 'red_light', 'fans', 'white_light', 'blue_light', 'sound'],
  tonic: ['sign', 'pink_light', 'mirros', 'whitelight', 'sound'],
  solido: ['sign', 'pink_light', 'mirros', 'whitelight', 'sound'],
  jab: ['spots', 'mirros', 'sign', 'blue_light', 'strober', 'whitelight', 'sound', 'red_light'],
  stride: ['mirros', 'red_light', 'blue_light', 'sign', 'strober', 'laser', 'sound', 'whitelight'],
  giro: ['blue_light', 'mirros', 'sign', 'sound'],
  buum: ['mirros', 'robotic_light', 'blue_light', 'sound'],
  lestrois: ['blue_light', 'mirros', 'sound', 'warm_tibet'],
  beats: ['strober', 'sound', 'warm_light'],
  level: ['sign', 'pink_light', 'mirros', 'whitelight', 'sound'],
};

// V8 clubs use AWS IoT, V3 clubs use Shiftr.io
const V8_CLUBS = [
  'CCFlorida',
  'LasPalmasBio26',
  'ParqueSabaneta',
  'LosMolinos',
  'VivaPalmas',
  'PlazaCampestre',
  'ElEden',
  'CedroBolivar',
  'Outlet',
  'Landmark',
  'ParqueDuraznos',
  'HotelMarriotSalitre',
  'Park',
  'Botafogo',
  'City',
];

export class MqttManager {
  private shiftrClient: MqttClient | null = null;
  private awsClient: MqttClient | null = null;
  private club: string = '';
  private room: string = '';
  private roomType: string = '';
  private soundInterval: NodeJS.Timeout | null = null;
  private automaticModeInterval: NodeJS.Timeout | null = null;
  private useAwsIot: boolean = false; // V8 clubs use AWS IoT, V3 clubs use Shiftr.io

  // Check if club should use AWS IoT (V8) or Shiftr.io (V3)
  private isV8Club(clubName: string): boolean {
    const normalizedClub = clubName.toLowerCase().replace(/\s+/g, '');
    return V8_CLUBS.some(v8Club => normalizedClub.includes(v8Club.toLowerCase()));
  }

  async connect(club: string, room: string): Promise<void> {
    this.club = club;
    this.room = room;
    this.roomType = room.toLowerCase().split('/')[0]; // Handle room types like "Savage/Jab"
    this.useAwsIot = this.isV8Club(club);

    console.log(`MQTT Manager: Club "${club}" will use ${this.useAwsIot ? 'AWS IoT (V8)' : 'Shiftr.io (V3)'}`);

    // Connect only to the appropriate broker based on club
    if (this.useAwsIot) {
      await this.connectAwsIot();
    } else {
      await this.connectShiftr();
    }

    // Start periodic sound checks (every 10 seconds)
    this.soundInterval = setInterval(() => {
      this.ensureSound();
    }, 10000);

    // Start automatic mode maintenance (every 30 seconds) - only for AWS IoT
    if (this.useAwsIot) {
      this.automaticModeInterval = setInterval(() => {
        this.setAutomaticMode();
      }, 30000);
    }
  }

  private async connectShiftr(): Promise<void> {
    const options = {
      protocol: 'mqtts' as const,
      clientId: `Control_${Date.now()}`,
      username: process.env.SHIFTR_USERNAME || 'sar-control',
      password: process.env.SHIFTR_PASSWORD || 'ETD3nN7tTZzawJ3V',
    };

    try {
      this.shiftrClient = mqtt.connect('mqtt://sar-control.cloud.shiftr.io', options);

      this.shiftrClient.on('connect', () => {
        console.log('Shiftr.io MQTT connected');
      });

      this.shiftrClient.on('error', (error) => {
        console.error('Shiftr.io MQTT error:', error);
      });
    } catch (error) {
      console.error('Failed to connect to Shiftr.io:', error);
    }
  }

  private async connectAwsIot(): Promise<void> {
    const url = await this.generateAwsIotUrl();
    if (!url) {
      console.error('Failed to generate AWS IoT URL');
      return;
    }

    try {
      this.awsClient = mqtt.connect(url, {
        clientId: `DesktopControl_${Date.now()}`,
        clean: true,
        keepalive: 60,
        reconnectPeriod: 5000,
      });

      this.awsClient.on('connect', () => {
        console.log('AWS IoT MQTT connected');
      });

      this.awsClient.on('error', (error) => {
        console.error('AWS IoT MQTT error:', error);
      });

      this.awsClient.on('close', () => {
        console.log('AWS IoT MQTT disconnected, will reconnect...');
      });
    } catch (error) {
      console.error('Failed to connect to AWS IoT:', error);
    }
  }

  private async generateAwsIotUrl(): Promise<string | null> {
    const endpoint = process.env.AWS_IOT_ENDPOINT;
    const region = process.env.AWS_REGION || 'us-west-2';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      console.error('Missing AWS IoT configuration');
      return null;
    }

    try {
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substr(0, 8);

      const algorithm = 'AWS4-HMAC-SHA256';
      const service = 'iotdevicegateway';
      const scope = `${dateStamp}/${region}/${service}/aws4_request`;

      const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': algorithm,
        'X-Amz-Credential': `${accessKeyId}/${scope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-SignedHeaders': 'host',
      });

      const canonicalRequest = this.createCanonicalRequest(
        'GET',
        '/mqtt',
        queryParams.toString(),
        { host: endpoint },
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );

      const hashedCanonicalRequest = crypto
        .createHash('sha256')
        .update(canonicalRequest)
        .digest('hex');

      const stringToSign = [algorithm, amzDate, scope, hashedCanonicalRequest].join('\n');

      const signingKey = this.getSignatureKey(secretAccessKey, dateStamp, region, service);
      const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

      queryParams.set('X-Amz-Signature', signature);

      return `wss://${endpoint}/mqtt?${queryParams.toString()}`;
    } catch (error) {
      console.error('Error generating AWS IoT URL:', error);
      return null;
    }
  }

  private createCanonicalRequest(
    method: string,
    uri: string,
    queryString: string,
    headers: Record<string, string>,
    hashedPayload: string
  ): string {
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key.toLowerCase()}:${headers[key]}`)
      .join('\n');

    const signedHeaders = Object.keys(headers)
      .sort()
      .map((key) => key.toLowerCase())
      .join(';');

    return [method, uri, queryString, canonicalHeaders, '', signedHeaders, hashedPayload].join('\n');
  }

  private getSignatureKey(
    key: string,
    dateStamp: string,
    regionName: string,
    serviceName: string
  ): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }

  publishLightSequence(sequence: number): void {
    if (this.useAwsIot) {
      // V8 clubs: Publish to AWS IoT with room-specific light control
      console.log(`MQTT: Publishing light sequence ${sequence} via AWS IoT`);
      this.sendLightSequenceToAws(sequence);
    } else {
      // V3 clubs: Publish to Shiftr.io (legacy simple format)
      const shiftrTopic = `${this.club}/${this.room}`;
      console.log(`MQTT: Publishing light sequence ${sequence} to Shiftr.io topic: ${shiftrTopic}`);
      this.shiftrClient?.publish(shiftrTopic, sequence.toString(), { qos: 0, retain: true });
    }
  }

  private sendLightSequenceToAws(sequence: number): void {
    const loads = roomLoadMapping[this.roomType];
    if (!loads) return;

    // Set automatic mode for all loads first
    loads.forEach((load, index) => {
      setTimeout(() => {
        this.publishToAws(load, 8); // 8 = automatic mode
      }, index * 100);
    });

    // Then send the light sequence
    setTimeout(() => {
      this.applyLightSequence(sequence);
    }, loads.length * 100 + 200);
  }

  private applyLightSequence(sequence: number): void {
    // Room-specific light sequences (ported from rutineV8.js)
    switch (this.roomType) {
      case 'savage':
        this.applySavageSequence(sequence);
        break;
      case 'tonic':
      case 'solido':
        this.applyTonicSequence(sequence);
        break;
      case 'jab':
        this.applyJabSequence(sequence);
        break;
      case 'stride':
        this.applyStrideSequence(sequence);
        break;
      default:
        // Generic sequence for other rooms
        this.publishToAws('sound', 1);
    }
  }

  private applySavageSequence(sequence: number): void {
    switch (sequence) {
      case 1:
        this.publishToAws('spots', 1);
        this.publishToAws('mirros', 1);
        this.publishToAws('sign', 1);
        this.publishToAws('red_light', 1);
        this.publishToAws('fans', 0);
        break;
      case 2:
      case 3:
        this.publishToAws('spots', 1);
        this.publishToAws('mirros', 1);
        this.publishToAws('sign', 0);
        this.publishToAws('red_light', 1);
        this.publishToAws('fans', 0);
        break;
      case 4:
        this.publishToAws('spots', 1);
        this.publishToAws('mirros', 0);
        this.publishToAws('sign', 0);
        this.publishToAws('red_light', 0);
        this.publishToAws('fans', 1);
        break;
    }
    this.publishToAws('sound', 1);
  }

  private applyTonicSequence(sequence: number): void {
    switch (sequence) {
      case 1:
        this.publishToAws('mirros', 1);
        this.publishToAws('sign', 1);
        this.publishToAws('pink_light', 0);
        break;
      case 2:
        this.publishToAws('mirros', 0);
        this.publishToAws('sign', 1);
        this.publishToAws('pink_light', 1);
        break;
    }
    this.publishToAws('sound', 1);
  }

  private applyJabSequence(sequence: number): void {
    switch (sequence) {
      case 1:
        this.publishToAws('spots', 1);
        this.publishToAws('mirros', 1);
        this.publishToAws('sign', 1);
        this.publishToAws('blue_light', 1);
        this.publishToAws('strober', 0);
        break;
      case 2:
        this.publishToAws('spots', 1);
        this.publishToAws('mirros', 1);
        this.publishToAws('sign', 0);
        this.publishToAws('blue_light', 1);
        this.publishToAws('strober', 0);
        break;
      case 3:
      case 4:
        this.publishToAws('spots', 0);
        this.publishToAws('mirros', 0);
        this.publishToAws('sign', 0);
        this.publishToAws('blue_light', 0);
        this.publishToAws('strober', 1);
        break;
    }
    this.publishToAws('sound', 1);
  }

  private applyStrideSequence(sequence: number): void {
    switch (sequence) {
      case 1:
        this.publishToAws('mirros', 1);
        this.publishToAws('red_light', 1);
        this.publishToAws('blue_light', 0);
        this.publishToAws('strober', 0);
        this.publishToAws('laser', 0);
        break;
      case 2:
        this.publishToAws('mirros', 1);
        this.publishToAws('red_light', 0);
        this.publishToAws('blue_light', 1);
        this.publishToAws('strober', 0);
        this.publishToAws('laser', 0);
        break;
      case 3:
        this.publishToAws('mirros', 0);
        this.publishToAws('red_light', 0);
        this.publishToAws('blue_light', 0);
        this.publishToAws('strober', 1);
        this.publishToAws('laser', 1);
        break;
    }
    this.publishToAws('sound', 1);
  }

  private publishToAws(loadType: string, controlValue: number): void {
    const topic = `${this.club.toLowerCase()}/${this.roomType}/${loadType}`;
    const payload = JSON.stringify({ control: controlValue });
    this.awsClient?.publish(topic, payload, { qos: 0 });
  }

  publishControl(loadType: string, controlValue: number): void {
    if (this.useAwsIot) {
      this.publishToAws(loadType, controlValue);
    } else {
      // For Shiftr.io, we use a simpler topic structure
      const topic = `${this.club}/${this.room}/${loadType}`;
      this.shiftrClient?.publish(topic, controlValue.toString(), { qos: 0 });
    }
  }

  setAutomaticMode(): void {
    // Only applicable for AWS IoT (V8) clubs
    if (!this.useAwsIot) return;

    const loads = roomLoadMapping[this.roomType];
    if (!loads) return;

    loads.forEach((load, index) => {
      setTimeout(() => {
        this.publishToAws(load, 8); // 8 = automatic mode
      }, index * 300);
    });

    // Ensure sound is on after setting automatic mode
    setTimeout(() => {
      this.ensureSound();
    }, loads.length * 300 + 500);
  }

  setManualMode(): void {
    // Only applicable for AWS IoT (V8) clubs
    if (!this.useAwsIot) return;

    const loads = roomLoadMapping[this.roomType];
    if (!loads) return;

    loads.forEach((load, index) => {
      setTimeout(() => {
        this.publishToAws(load, 9); // 9 = manual mode
      }, index * 300);
    });
  }

  ensureSound(): void {
    if (this.useAwsIot) {
      // AWS IoT: Triple redundancy for sound (from original rutineV8.js)
      this.publishToAws('sound', 1);
      setTimeout(() => this.publishToAws('sound', 1), 100);
      setTimeout(() => this.publishToAws('sound', 1), 300);
    } else {
      // Shiftr.io: Simple sound control
      const topic = `${this.club}/${this.room}/sound`;
      this.shiftrClient?.publish(topic, '1', { qos: 0, retain: true });
    }
  }

  disconnect(): void {
    if (this.soundInterval) {
      clearInterval(this.soundInterval);
      this.soundInterval = null;
    }
    if (this.automaticModeInterval) {
      clearInterval(this.automaticModeInterval);
      this.automaticModeInterval = null;
    }
    this.shiftrClient?.end();
    this.awsClient?.end();
    this.shiftrClient = null;
    this.awsClient = null;
  }
}
