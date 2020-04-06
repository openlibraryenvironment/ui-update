import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, injectIntl } from 'react-intl';
import { Form, Field } from 'react-final-form';
import _ from 'lodash';
import { Icon, Headline, KeyValue, MessageBanner, Modal, Layout, Row, Col, Select, TextField, MultiColumnList } from '@folio/stripes/components';
import CatalogInfo from '@folio/stripes-reshare/cards/CatalogInfo';
import RequesterSupplier from '@folio/stripes-reshare/cards/RequesterSupplier';
import useOkapiKy from '@folio/stripes-reshare/util/useOkapiKy';

const scanActions = [
  'supplierCheckInToReshare',
  'supplierMarkShipped',
  'supplierCheckOutOfReshare',
  'requesterReceived',
  'shippedReturn',
];

const STATUS = Object.freeze({
  PENDING: 1,
  SUCCESS: 2,
  FAIL: 3,
});

const scanFormatter = { status: scan => {
  if (scan.status === STATUS.SUCCESS) {
    return <Icon size="large" icon="check-circle" status="success" />;
  }
  if (scan.status === STATUS.FAIL) {
    return <Icon size="large" icon="times-circle-solid" status="error" />;
  }
  return <Icon size="large" icon="clock" />;
} };

// Need this outside the component as it gets re-rendered while the modal
// is still up. When tidying this and breaking into separate files I'll
// try and have the modal-promise-maker inject the whole thing into the DOM
// from within the promise so it can be self-contained
const itemModalHandlers = {};

const ScanRoute = ({ intl }) => {
  const [currentAction, setCurrentAction] = useState(scanActions[0]);
  const [selScan, setSelScan] = useState(null);
  const [scans, setScans] = useState([]);
  const [scanData, setScanData] = useState({});
  const [showItemModal, setShowItemModal] = useState(false);
  const itemModalInput = useRef();
  const selData = scanData?.[selScan];
  const selReq = selData?.request;
  const updateScan = (scannedAt, newData) => {
    setScanData(prev => ({ ...prev, [scannedAt]: { ...prev[scannedAt], ...newData } }));
  };
  const okapiKy = useOkapiKy();

  // mod-rs action names are translated in stripes-reshare, but some are specific to this app
  // TODO: this can easily be factored out into a hook once stripes-core upgrades react-intl
  // so useIntl is available
  const trAction = (action, suffix = '') => {
    if (`ui-update.actions.${action}` in intl.messages) {
      return intl.formatMessage({ id: `ui-update.actions.${action}${suffix}` });
    }
    return intl.formatMessage({ id: `stripes-reshare.actions.${action}${suffix}` });
  };

  const getItemBarcode = () => {
    const itemBarcodePromise = new Promise((resolve, reject) => {
      itemModalHandlers.cancel = () => {
        setShowItemModal(false);
        reject(new Error(intl.formatMessage({ id: 'ui-update.error.dismissed' })));
      };
      itemModalHandlers.submit = (values) => {
        setShowItemModal(false);
        resolve(values.itemBarcode);
      };
    });
    setShowItemModal(true);
    return itemBarcodePromise;
  };

  const actionChange = e => {
    setScans([]);
    setScanData({});
    setCurrentAction(e.target.value);
  };

  const onSubmit = (values, form) => {
    // scannedAt functions as the id of the scan rather than reqId, enabling
    const scannedAt = Date.now();
    const updateThis = newData => updateScan(scannedAt, newData);
    updateThis({ status: STATUS.PENDING, hrid: values.hrid });
    setScans([scannedAt, ...scans]);
    setSelScan(scannedAt);

    // These take performAction even though it's defined in this scope in hopes of this one day being its own file
    const scanHandlers = {
      supplierCheckInToReshare: async (requestPromise, performAction) => {
        const itemBarcode = await getItemBarcode();
        const request = await requestPromise;
        return performAction(request, 'supplierCheckInToReshare', { itemBarcode });
      },
    };

    const performAction = async (request, action, actionParams = {}) => {
      if (!request.validActions.includes(action)) {
        throw new Error(intl.formatMessage({ id: 'ui-update.error.notValidForState' }));
      }
      return okapiKy.post(`rs/patronrequests/${request.id}/performAction`, { json: { action, actionParams } });
    };

    // Reset form so user can proceed to scan the next item while this is loading
    form.initialize(_.omit(values, 'hrid'));

    // Give scanHandlers a promise rather than a resolved request so they can
    // choose to include logic that happens without waiting for the request or
    // merely await it.
    const requestPromise = (async () => {
      const results = await okapiKy.get('rs/patronrequests', { searchParams: { match: 'hrid', term: values.hrid } }).json();
      if (results?.length === 1) {
        const request = results[0];
        updateThis({ request });
        return request;
      } else if (results?.length > 1) {
        // Should never happen in real world use, may happen in dev environments where requester and supplier are the same tenant
        throw new Error(intl.formatMessage({ id: 'ui-update.error.multipleRequestsForHRID' }));
      }
      throw new Error(intl.formatMessage({ id: 'ui-update.error.noRequest' }));
    })();

    (async () => {
      if (currentAction in scanHandlers) {
        await scanHandlers[currentAction](requestPromise, performAction);
      }
      const request = await requestPromise;
      if (!(currentAction in scanHandlers)) {
        await performAction(request, currentAction);
      }
      const updated = await okapiKy.get(`rs/patronrequests/${request.id}`).json();
      updateThis({ request: updated, status: STATUS.SUCCESS });
    })()
      .catch(error => {
        updateThis({ status: STATUS.FAIL, error });
      });
  };

  const formattedScans = scans.map(scannedAt => {
    const scan = scanData[scannedAt];
    return {
      status: scan?.status ?? '',
      hrid: scan?.hrid ?? '',
      requester: scan?.request?.requestingInstitutionSymbol ?? '',
      supplier: scan?.request?.supplyingInstitutionSymbol ?? '',
      title: scan?.request?.title ?? '',
      scannedAt,
    };
  });

  return (
    <Layout className="padding-all-gutter">
      <Row>
        <Col xs={8}>
          <Row>
            <Col xs={6}>
              <Select onChange={actionChange}>
                {scanActions.map(action => (
                  <option key={action} value={action}>{trAction(action)}</option>
                ))}
              </Select>
            </Col>
            <Col xs={6}>
              <Form
                onSubmit={onSubmit}
                render={({ handleSubmit, form }) => (
                  <form onSubmit={handleSubmit}>
                    <Field name="hrid" component={TextField} autoFocus placeholder="Scan or enter barcode..." />
                  </form>
                )}
              />
            </Col>
          </Row>
          {formattedScans.length > 0 &&
            <MultiColumnList
              contentData={formattedScans}
              formatter={scanFormatter}
              visibleColumns={['status', 'hrid', 'requester', 'supplier', 'title']}
              isSelected={({ item }) => selScan === item.scannedAt}
              onRowClick={(e, row) => setSelScan(row.scannedAt)}
              columnMapping={{
                status: '',
                hrid: <FormattedMessage id="ui-update.column.hrid" />,
                requester: <FormattedMessage id="ui-update.column.requester" />,
                supplier: <FormattedMessage id="ui-update.column.supplier" />,
                title: <FormattedMessage id="ui-update.column.title" />
              }}
              // It would be better to express the fixed-width columns in em and let
              // the remaining space go to Title, alas there seems to be an MCL bug
              // preventing this. Adding up to less than 100% is necessary to avoid
              // scrollbars introduced by some negative margin somewhere.
              columnWidths={{
                status: '5%',
                hrid: '30%',
                requester: '10%',
                supplier: '10%',
                title: '44%',
              }}
            />
          }
        </Col>
        <Col xs={4}>
          {selScan === null && 'Scan an item!'}
          {selData && (
            <>
              <Headline size="x-large" margin="none">{selData.hrid}</Headline>
              {selData.status === STATUS.SUCCESS && (
                <MessageBanner type="success">
                  <FormattedMessage id={trAction(currentAction, '.success')} />
                </MessageBanner>
              )}
              {selData.status === STATUS.FAIL && (
                <MessageBanner type="error">
                  <KeyValue label={<FormattedMessage id={trAction(currentAction, '.error')} />}>
                    {selData.error?.message || ''}
                  </KeyValue>
                </MessageBanner>
              )}
              {selReq && (
                <>
                  <KeyValue label={<FormattedMessage id="stripes-reshare.requestStatus" />}>
                    <Headline size="large" faded><FormattedMessage id={`stripes-reshare.states.${selReq?.state?.code}`} /></Headline>
                  </KeyValue>
                  <CatalogInfo request={selReq} />
                  <RequesterSupplier request={selReq} />
                </>
              )}
            </>
          )}
        </Col>
      </Row>
      <Modal
        open={showItemModal}
        onOpen={() => itemModalInput.current.focus()}
        onClose={() => itemModalHandlers.cancel()}
        label={<FormattedMessage id="ui-update.checkInPrompt" />}
        dismissible
        restoreFocus
      >
        <Form
          onSubmit={itemModalHandlers.submit}
          render={({ handleSubmit }) => (
            <form onSubmit={handleSubmit} autoComplete="off">
              <Field name="itemBarcode" inputRef={itemModalInput} component={TextField} />
            </form>
          )}
        />
      </Modal>
    </Layout>
  );
};

ScanRoute.propTypes = {
  intl: PropTypes.object.isRequired,
};

export default injectIntl(ScanRoute);
