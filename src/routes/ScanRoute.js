import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, injectIntl } from 'react-intl';
import { Form, Field } from 'react-final-form';
import _ from 'lodash';
import { Card, Icon, Headline, KeyValue, MessageBanner, Layout, Row, Col, Select, TextField, MultiColumnList } from '@folio/stripes/components';
import CatalogInfo from '@folio/stripes-reshare/cards/CatalogInfo';
import RequesterSupplier from '@folio/stripes-reshare/cards/RequesterSupplier';
import useOkapiKy from '@folio/stripes-reshare/util/useOkapiKy';

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

const ScanRoute = ({ intl }) => {
  // Unfortunately, it doesn't seem to be readily possible to initialise at the field level.
  // So either we put the initial status here and always get that value even when the control
  // is invisible, or we exclude it and don't get a value for status when the default is accepted
  // and not explicitly chosen.
  const initialValues = {
    action: 'supplierMarkShipped',
  };
  const [currentAction, setCurrentAction] = useState(initialValues.action);
  const [selScan, setSelScan] = useState(null);
  const [scans, setScans] = useState([]);
  const [scanData, setScanData] = useState({});
  const selData = scanData?.[selScan];
  const selReq = selData?.request;
  const updateScan = (scannedAt, newData) => {
    setScanData(prev => ({ ...prev, [scannedAt]: { ...(prev[scannedAt] || {}), ...newData } }));
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

  const scanActions = ['supplierMarkShipped'];
  const scanHandlers = {
    supplierCheckInToReshare: async (request, performAction) => {},
  };

  const actionChange = e => setCurrentAction(e.target.value);

  const onSubmit = (values, form) => {
    // scannedAt functions as the id of the scan rather than reqId, enabling
    const scannedAt = Date.now();
    let request;
    const updateThis = newData => updateScan(scannedAt, newData);
    updateThis({ status: STATUS.PENDING, hrid: values.hrid });
    setScans([scannedAt, ...scans]);
    setSelScan(scannedAt);

    const performAction = async (action, actionParams = {}) => {
      if (!request.validActions.includes(action)) {
        throw new Error(intl.formatMessage({ id: 'ui-update.error.notValidForState' }));
      }
      okapiKy.post(`rs/patronrequests/${request.id}/performAction`, { json: { action, actionParams } });
    };

    // reset form so user can proceed to scan the next item while this is loading
    form.initialize(_.omit(values, 'hrid'));

    okapiKy.get('rs/patronrequests', { searchParams: { match: 'hrid', term: values.hrid } })
      .json()
      .then(res => {
        // One would thing hrid should find exactly one record, but some test requests use the same institution
        // as both requester and supplier so not making this check length === 1 for now
        if (res?.length > 0) {
          request = res[0];
          updateThis({ request });
        } else {
          throw new Error(intl.formatMessage({ id: 'ui-update.error.noRequest' }));
        }

        if (values.action in scanHandlers) {
          return scanHandlers[values.action](performAction);
        } else {
          return performAction(values.action);
        }
      })
      .then(() => {
        return okapiKy.get(`rs/patronrequests/${request.id}`).json();
      })
      .then(res => updateThis({ request: res, status: STATUS.SUCCESS }))
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
          <Form
            onSubmit={onSubmit}
            initialValues={initialValues}
            render={({ handleSubmit, form }) => (
              <form onSubmit={handleSubmit}>
                <Row>
                  <Col xs={6}>
                    <Field name="action" component={Select} input={{ onChange: actionChange }} required>
                      {scanActions.map(action => (
                        <option key={action} value={action}>{trAction(action)}</option>
                      ))}
                    </Field>
                  </Col>
                  <Col xs={6}>
                    <Field name="hrid" component={TextField} autoFocus placeholder="Scan or enter barcode..." />
                  </Col>
                </Row>
              </form>
            )}
          />
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
                    {selData.error.toString() || ''}
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
    </Layout>
  );
};

ScanRoute.propTypes = {
  intl: PropTypes.object.isRequired,
};

export default injectIntl(ScanRoute);
