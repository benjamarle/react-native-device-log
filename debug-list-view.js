import React from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Animated,
    TouchableOpacity,
    PixelRatio,
    NativeModules,
    LayoutAnimation,
} from "react-native";
import debugService from "./debug-service";
import InvertibleScrollView from "react-native-invertible-scroll-view";
const NativeAnimatedModule = NativeModules.NativeAnimatedModule;

const DEFAULT_BORDER_COLOR = "#3b3b3b";
const DEFAULT_SELECT_COLOR = "#292929";
const DEFAULT_SEPARATOR_COLOR = "rgb(252, 217, 28)";
const DEFAULT_BACKGROUND_COLOR = "#181818";
const DEFAULT_TEXT_COLOR = "#D6D6D6";


export default class Debug extends React.Component {

    constructor(props) {
        super(props);

        this.preparedRows = { blob: {} };
        this.listViewRef = React.createRef();
        this.state = {
            dataSource: [],
            paused: props.paused,
            rows: [],
        };
        this.styleSheet = getStyleSheet(props)
    }

    prepareRows(rows) {
        return rows.reduce((o, m, i) => {
            const previousRender =
                this.preparedRows !== undefined
                    ? this.preparedRows[m.id]
                    : null;
            const previousRenderExists = !!previousRender;
            o[m.id] = {
                ...m,
                anim: previousRenderExists
                    ? previousRender.anim
                    : new Animated.Value(0),
            };
            return o;
        }, []);
    }

    isPaused(){
        return !this.props.paused && !this.state.paused;
    }

    renderList(props) {
        if (this.isPaused()) {
            this.preparedRows = this.prepareRows(props.rows);
            let rowsToRender = [];
            if(this.preparedRows){
                rowsToRender = Object.values(this.preparedRows);
            }
            this.setState({
                rows: props.rows,
                dataSource: rowsToRender
            });
        }
    }

    componentWillReceiveProps(nextProps) {
        this.renderList(nextProps);
        this.styleSheet = getStyleSheet(this.props)
    }

    onPauseButtonPressed() {
        this.setState({
            paused: !this.state.paused,
        });
        this.renderList(this.props);
    }

    onClearButtonPressed() {
        debugService.clear();
    }

    _formatTimeStamp(timeStamp, rowData) {
        if (rowData.format) {
            return rowData.format(timeStamp);
        }
        return timeStamp.format(this.props.timeStampFormat || "HH:mm:ss");
    }

    onRowPress(rowID) {
        const rowBefore = this.preparedRows[rowID];
        if (this.props.multiExpanded) {
            const row = this.state.rows.find(row => row.id === rowID);
            row.expanded = !row.expanded;
        } else {
            this.state.rows.forEach(row => {
                row.expanded = row.id === rowID && !row.expanded;
            });
        }
        this.preparedRows = this.prepareRows(this.state.rows);
        LayoutAnimation.configureNext({
            update: {
                springDamping: 0.7,
                type: "spring",
            },
            duration: 650,
        });
        let rowsToRender = [];
        if(this.preparedRows){
            rowsToRender = Object.values(this.preparedRows);
        }
        this.setState({
            dataSource: rowsToRender
        });
    }

    onRowLayout(rowData) {
        Animated.timing(rowData.anim, {
            useNativeDriver: !!NativeAnimatedModule,
            toValue: 1,
            duration: 700,
        }).start();
    }

    _renderSeparator(rowData, animationStyle) {
        const separatorStyles = [
            this.styleSheet.logRowMessage,
            this.styleSheet.logRowMessageBold,
            this.styleSheet.separator,
        ];
        return (
            <Animated.View
                style={[this.styleSheet.debugRowContainer, animationStyle]}
                onLayout={this.onRowLayout.bind(this, rowData)}
            >
                {this.props.renderLevel && <Text style={separatorStyles}>*****</Text>}
                <Text
                    style={[
                        this.styleSheet.logRowMessage,
                        this.styleSheet.logRowMessageMain,
                        this.styleSheet.logRowMessageSeparator,
                    ]}
                >
                    {rowData.message}
                    - {rowData.timeStamp.format("YYYY-MM-DD HH:mm:ss")}
                </Text>
                {this.props.renderTimestamp && <Text style={separatorStyles}>*****</Text>}
            </Animated.View>
        );
    }

    _renderLogRow(rowData, rowID, animationStyle) {
        return (
            <Animated.View
                style={[
                    this.styleSheet.debugRowContainer,
                    animationStyle,
                    {
                        backgroundColor: rowData.expanded
                            ? this.styleSheet.selectColor
                            : "transparent",
                    },
                ]}
                onLayout={this.onRowLayout.bind(this, rowData)}
            >
                <TouchableOpacity
                    style={[
                        this.styleSheet.debugRowContainerButton,
                        {
                            maxHeight: rowData.expanded ? undefined : 25,
                        },
                    ]}
                    onPress={this.onRowPress.bind(this, rowID)}
                >
                    {this.props.renderLevel && <Text
                        style={[this.styleSheet.logRowMessage, this.styleSheet.logRowLevelLabel]}
                    >
                        {`[${rowData.level.toUpperCase()}]`}
                    </Text>}
                    <Text
                        style={[
                            this.styleSheet.logRowMessage,
                            this.styleSheet.logRowMessageMain,
                            {
                                color: rowData.color,
                            },
                        ]}
                    >
                        {rowData.message}
                    </Text>
                    {this.props.renderTimestamp && <Text style={this.styleSheet.logRowMessage}>
                        {this._formatTimeStamp(rowData.timeStamp, rowData)}
                    </Text>}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    _getRowKey(rowData){
        return rowData.id
    }
    
    _renderRow(row) {
        let animationStyle = {};
        const rowData = row.item;
        const rowID = rowData.id;
        if (rowData.anim) {
            animationStyle = {
                opacity: rowData.anim,
                transform: [
                    {
                        scale: rowData.anim.interpolate({
                            inputRange: [0, 0.3, 1],
                            outputRange: [1, 1.05, 1],
                        }),
                    },
                ],
            };
        }

        switch (rowData.level) {
            case "separator":
                return this._renderSeparator(
                    rowData,
                    animationStyle
                );
            default:
                return this._renderLogRow(
                    rowData,
                    rowID,
                    animationStyle
                );
        }
    }

    onCenterColumnPressed() {
        if (this.listViewRef.current) {
            this.listViewRef.current.scrollTo({ x: 0, y: 0, animated: true });
        }
    }

    renderToolbar(){
        if(this.props.renderToolbar){
            let options = {
                onPause: this.onPauseButtonPressed.bind(this), 
                onClear: this.onClearButtonPressed.bind(this), 
                length: this.state.rows
            }
            return this.props.renderToolbar(options)
        }
        return (<View style={this.styleSheet.toolBar}>
            <TouchableOpacity
                style={this.styleSheet.toolbarButton}
                onPress={this.onPauseButtonPressed.bind(this)}
            >
                <Text style={this.styleSheet.toolbarButtonText}>
                    {this.state.paused ? "Resume log" : "Pause log"}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={this.onCenterColumnPressed.bind(this)}
                style={this.styleSheet.centerColumn}
            >
                <Text style={this.styleSheet.titleText}>{`${this.state.rows
                    .length} rows`}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={this.styleSheet.toolbarButton}
                onPress={this.onClearButtonPressed.bind(this)}
            >
                <Text style={this.styleSheet.toolbarButtonText}>Clear log</Text>
            </TouchableOpacity>
        </View>)
    }

    render() {
        const { rows, ...props } = this.props;
        return (
            <View style={this.styleSheet.container}>
                {this.renderToolbar()}
                <View style={this.styleSheet.listContainer}>
                    <FlatList
                        keyboardShouldPersistTaps="always"
                        automaticallyAdjustContentInsets={false}
                        initialListSize={20}
                        pageSize={20}
                        renderScrollComponent={props => (
                            <InvertibleScrollView
                                {...props}
                                inverted={this.props.inverted}
                            />
                        )}
                        enableEmptySections={true}
                        ref={this.listViewRef}
                        data={this.state.dataSource}
                        renderItem={this._renderRow.bind(this)}
                        keyExtractor={this._getRowKey.bind(this)}
                        {...props}
                    />
                </View>
            </View>
        );
    }
}

const getStyleSheet = (props)=>{
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: props.backgroundColor,
            paddingTop: 5,
        },
        toolBar: {
            backgroundColor: props.backgroundColor,
            flexDirection: "row",
            padding: 10,
            borderBottomWidth: 2,
            borderColor: props.borderColor,
        },
        toolbarButton: {
            padding: 7,
            borderWidth: 2,
            borderRadius: 7,
            borderColor: props.borderColor,
        },
        centerColumn: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
        },
        titleText: {
            color: props.textColor,
            fontWeight: "bold",
            fontFamily: "System",
            fontSize: 16,
            alignSelf: "center",
            textAlign: "center",
        },
        toolbarButtonText: {
            color: props.textColor,
            fontFamily: "System",
            fontSize: 12,
        },
        listContainer: {
            flex: 1,
        },
        debugRowContainer: {
            padding: 5,
            flex: 1,
            flexDirection: "row",
            backgroundColor: props.backgroundColor,
            borderStyle: "solid",
            borderBottomWidth: 1 / PixelRatio.get(),
            borderBottomColor: props.borderColor,
        },
        debugRowContainerButton: {
            flexDirection: "row",
            flex: 1,
            overflow: "hidden",
        },
        logRowMessage: {
            color: props.textColor,
            fontFamily: "System",
            fontSize: 11,
            paddingHorizontal: 5,
            lineHeight: 20,
        },
        logRowMessageBold: {
            fontWeight: "bold",
        },
        logRowLevelLabel: {
            minWidth: 80,
            fontWeight: "bold",
        },
        logRowMessageSeparator: {
            fontSize: 11,
            fontWeight: "bold",
            textAlign: "center",
            color: props.separatorColor,
        },
        separator: {
            fontSize: 18,
            color: props.separatorColor,
        },
        logRowMessageMain: {
            flex: 1,
        },
        welcome: {
            fontSize: 20,
            textAlign: "center",
            margin: 10,
        },
        instructions: {
            textAlign: "center",
            color: "#333333",
            marginBottom: 5,
        },
    });
}

Debug.defaultProps = {
    borderColor : DEFAULT_BORDER_COLOR,
    selectColor : DEFAULT_SELECT_COLOR,
    separatorColor : DEFAULT_SEPARATOR_COLOR,
    backgroundColor : DEFAULT_BACKGROUND_COLOR,
    textColor : DEFAULT_TEXT_COLOR,
    renderLevel : true,
    renderTimestamp : true,
    paused: false
};
